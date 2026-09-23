"""0022: local H5 regression for the visible requirements from Change 0020.

Real: Vue page, device selection, timeline Canvas, application CSS.
Simulated: API method results and Tencent SDK rendering. All external HTTP and
WebSocket connections are blocked; no credentials or persistent profile used.
Run through ``pnpm test``; plain unittest does not apply the mandatory-test gate.
"""

import argparse
import os
from pathlib import Path
import sys
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


# Expose SDK geometries as SVG, not a second implementation of the application's
# stationary/moving decision. No map tiles, WebGL or geodesic accuracy tested.
MAP_SDK = r"""
(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (name, attrs) => {
    const el = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };
  class LatLng {
    constructor(lat, lng) { this.lat = lat; this.lng = lng; }
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }
  class Map {
    constructor(element, options) {
      this.element = element;
      this.center = options.center;
      this.svg = svgNode('svg', {viewBox: '0 0 400 400', width: '100%', height: '100%',
        'data-map-stub': 'true', 'aria-label': 'isolated SDK geometry renderer'});
      this.svg.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      element.append(this.svg);
      // MapOptions.showControl defaults true (Tencent native GLJS Map reference,
      // checked 2026-09-20). control.zoom/rotation is not that native contract.
      // This flow layout is a synthetic application-CSS fixture, not SDK pixels.
      const controls = document.createElement('div');
      controls.className = 'tmap-control-container';
      controls.style.cssText = 'position:absolute;right:0;top:0';
      this.controls = Object.create(null);
      for (const [key, cls, label] of [
        ['zoom', 'tmap-zoom-control', '+ / −'],
        ['rotation', 'tmap-rotate-control', 'N']
      ]) {
        if (options.showControl === false) continue;
        const button = document.createElement('button');
        button.className = cls;
        button.textContent = label;
        button.style.cssText = 'position:relative;display:block;right:10px;top:10px';
        controls.append(button);
        this.controls[key] = {element: button};
      }
      element.append(controls);
    }
    panTo(center) { this.center = center; }
    getControl(id) { return this.controls[id]; }
    removeControl(id) {
      this.controls[id]?.element.remove();
      delete this.controls[id];
    }
    destroy() { this.svg.remove(); }
  }
  class Layer {
    constructor(options, kind) {
      this.options = options;
      this.group = svgNode('g', {'data-map-layer': kind,
        'data-map-style': Object.keys(options.styles || {}).join(' ')});
      options.map.svg.append(this.group);
      this.setGeometries(options.geometries || []);
    }
    setGeometries(geometries) {
      this.geometries = geometries;
      this.group.replaceChildren();
      for (const geometry of geometries) {
        const style = this.options.styles?.[geometry.styleId] || {};
        if (this.group.dataset.mapLayer === 'circle') {
          this.group.append(svgNode('circle', {cx: 200, cy: 200,
            r: Math.min(80, geometry.radius), fill: style.color || 'none',
            stroke: style.borderColor || 'none', 'stroke-width': style.borderWidth || 1}));
        } else if (this.group.dataset.mapLayer === 'line') {
          for (const segment of geometry.rainbowPaths || []) {
            const points = segment.path.map(p =>
              `${200 + (p.lng - 114.33) * 10000},${200 - (p.lat - 34.79) * 10000}`).join(' ');
            this.group.append(svgNode('polyline', {points, fill: 'none',
              stroke: segment.color, 'stroke-width': style.width || 6}));
          }
        }
      }
    }
  }
  window.TMap = {
    LatLng, Map,
    constants: {DEFAULT_CONTROL_ID: {ZOOM: 'zoom', ROTATION: 'rotation'}},
    CircleStyle: class { constructor(value) { Object.assign(this, value); } },
    PolylineStyle: class { constructor(value) { Object.assign(this, value); } },
    MarkerStyle: class { constructor(value) { Object.assign(this, value); } },
    MultiCircle: class extends Layer { constructor(o) { super(o, 'circle'); } },
    MultiPolyline: class extends Layer { constructor(o) { super(o, 'line'); } },
    MultiMarker: class extends Layer { constructor(o) { super(o, 'marker'); } }
  };
})();
"""


API_FIXTURE = r"""() => {
  const now = Date.now();
  const makeTrack = moving => Array.from({length: 9}, (_, i) => ({
    index: i, lat: 34.79 + (moving ? i * 0.0007 : 0),
    lng: 114.33 + (moving ? i * 0.0007 : 0),
    gcjLat: 34.79 + (moving ? i * 0.0007 : 0),
    gcjLng: 114.33 + (moving ? i * 0.0007 : 0),
    speed: moving ? [8, 12, 25, 50, 32, 18, 40, 30, 24][i] : 0,
    timestamp: now - (8 - i) * 60000,
    timeStr: new Date(now - (8 - i) * 60000).toISOString().replace('T', ' ').slice(0, 19),
    isMultiDay: false
  }));
  const devices = [false, true].map((moving, i) => ({
    imei: `99000000000000${i + 1}`, name: moving ? '回归移动资产' : '回归静止资产',
    shortName: moving ? '移动样本' : '静止样本', online: true,
    lat: 34.79, lng: 114.33, gcjLat: 34.79, gcjLng: 114.33,
    speed: moving ? 24 : 0, voltageMv: 4000, csq: 25, battPct: 80,
    lastActiveTime: new Date(now).toISOString().replace('T', ' ').slice(0, 19),
    relativeTime: '刚刚', coordText: '34.79, 114.33', fixType: 'GPS', address: '隔离测试位置'
  }));
  // Replace only the upstream adapter in this disposable context. The actual
  // refresh/select handlers still own device state and render the page.
  window.apiClient.getDeviceList = async () => devices;
  window.apiClient.getHistoricalTrack = async imei => makeTrack(imei.endsWith('2'));
  window.apiClient.getRealTagTelemetry = async () => ({});
}"""


# Sample the actual raster away from the centred text watermark. Heights
# distinguish a flat stationary band from a varied moving speed profile.
CANVAS_DRAW_OBSERVER = r"""(() => {
  const proto = CanvasRenderingContext2D.prototype;
  const fillText = proto.fillText;
  const fillRect = proto.fillRect;
  proto.fillText = function(text, ...args) {
    const result = fillText.call(this, text, ...args);
    this.__mapRegressionText = String(text);
    return result;
  };
  proto.fillRect = function(x, y, w, h) {
    if (x === 0 && y === 0 && w >= this.canvas.width / devicePixelRatio
        && h >= this.canvas.height / devicePixelRatio) this.__mapRegressionText = '';
    return fillRect.call(this, x, y, w, h);
  };
})();"""


CANVAS_PROFILE = r"""() => {
  const host = document.getElementById('speed-wave-canvas');
  const canvas = host?.tagName === 'CANVAS' ? host : host?.querySelector('canvas');
  if (!canvas || !canvas.width || !canvas.height) throw new Error('Canvas has no raster');
  const ctx = canvas.getContext('2d');
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const heights = [0.05, 0.12, 0.2, 0.8, 0.88, 0.95].map(fraction => {
    const x = Math.floor(canvas.width * fraction);
    for (let y = 0; y < canvas.height; y++) {
      const offset = (y * canvas.width + x) * 4;
      if (data[offset + 1] > 45 || data[offset + 2] > 60)
        return (canvas.height - y) / devicePixelRatio;
    }
    return 0;
  });
  let watermarkInk = 0;
  for (let y = Math.floor(canvas.height * 0.2); y < canvas.height * 0.65; y++) {
    for (let x = Math.floor(canvas.width * 0.2); x < canvas.width * 0.8; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (data[offset + 1] > 45 || data[offset + 2] > 60) watermarkInk++;
    }
  }
  return {heights, width: canvas.width, height: canvas.height,
    cssHeight: canvas.height / devicePixelRatio, watermarkInk,
    watermarkText: ctx.__mapRegressionText || ''};
}"""


class MapUIRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ.get('AIRTRACK_TEST_URL', '')
        target = urlsplit(cls.url)
        if (target.scheme != 'http' or target.hostname not in ('127.0.0.1', 'localhost')
                or not target.port or target.username or target.password):
            raise ValueError('AIRTRACK_TEST_URL must be an explicit http://127.0.0.1:<port>/ local URL')
        cls.origin = f'{target.scheme}://{target.netloc}'
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.addClassCleanup(cls.browser.close)
        print(f'Browser: Chromium {cls.browser.version}; URL: {cls.url}', flush=True)

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 393, 'height': 852},
                                                device_scale_factor=1, service_workers='block')
        self.addCleanup(self.context.close)
        self.unexpected_requests = []
        self.page_errors = []
        self.context.route('**/*', self.route_request)
        self.context.route_web_socket('**/*', self.route_socket)
        self.context.add_init_script(CANVAS_DRAW_OBSERVER)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.page_errors.append(str(error)))
        self.addCleanup(self.save_evidence)
        self.page.goto(self.url, wait_until='domcontentloaded', timeout=30000)
        expect(self.page.locator('#btn-close-official-modal')).to_be_visible()
        self.page.locator('#btn-close-official-modal').click()
        expect(self.page.locator('#official-modal')).to_have_count(0)
        self.page.wait_for_function('() => window.apiClient && window.__loadTrackPoints')
        self.page.evaluate(API_FIXTURE)
        self.page.locator('#btn-refresh-devices-mobile').click()
        expect(self.page.locator('#mob-tab-dev-990000000000001')).to_be_visible()
        expect(self.page.locator('#map-track-loading-capsule')).to_have_count(0)

    def route_socket(self, socket):
        if urlsplit(socket.url).netloc == urlsplit(self.origin).netloc:
            socket.connect_to_server()  # Vite's local HMR is part of the test server.
        else:
            self.unexpected_requests.append(socket.url)
            socket.close()

    def route_request(self, route):
        url = urlsplit(route.request.url)
        origin = f'{url.scheme}://{url.netloc}'
        if origin == self.origin:
            route.continue_()
        elif url.hostname == 'map.qq.com' and url.path == '/api/gljs':
            route.fulfill(content_type='application/javascript', body=MAP_SDK)
        elif url.hostname == 'cdn.tailwindcss.com':
            # UnoCSS and checked-in CSS remain real; no injected layout CSS.
            route.fulfill(content_type='application/javascript', body='window.tailwind = {};')
        elif url.hostname == 'unpkg.com' and url.path.startswith('/lucide@'):
            route.fulfill(content_type='application/javascript', body='window.lucide = {createIcons() {}};')
        elif url.hostname == 'cdn.jsdelivr.net' and '/echarts@' in url.path:
            route.fulfill(content_type='application/javascript', body='window.echarts = {};')
        elif origin == 'http://127.0.0.1:28202':
            route.fulfill(status=503, body='isolated regression: station unavailable')
        else:
            self.unexpected_requests.append(f'{url.scheme}://{url.netloc}{url.path}')
            route.abort('blockedbyclient')

    def save_evidence(self):
        directory = os.environ.get('AIRTRACK_EVIDENCE_DIR')
        if directory:
            output = Path(directory).resolve()
            output.mkdir(parents=True, exist_ok=True)
            path = output / f'{self._testMethodName}.png'
            self.page.screenshot(path=str(path))
            print(f'Screenshot: {path}', flush=True)

    def tearDown(self):
        self.assertEqual(self.unexpected_requests, [], 'Unmodelled external request was blocked')
        self.assertEqual(self.page_errors, [], 'Unexpected page exception')

    def assert_stationary(self):
        expect(self.page.locator('#live-state-text')).to_have_text('原地静止')
        expect(self.page.locator('#live-state-text')).to_be_visible()
        expect(self.page.locator('#live-latest-speed')).to_have_text('0.0 km/h')
        dwell = self.page.locator('[data-map-style="dwell_style"] circle')
        expect(dwell).to_have_count(1)
        expect(dwell).to_be_visible()
        expect(self.page.locator('[data-map-layer="line"] polyline')).to_have_count(0)
        expect(self.page.locator('#speed-wave-canvas')).to_be_visible()
        profile = self.page.evaluate(CANVAS_PROFILE)
        # Escape diagnostic data for pipes using non-Unicode console encodings.
        print(f'{self._testMethodName} stationary raster: {profile!a}', flush=True)
        # A 1–2 px baseline still looks empty. Distinguish that counterexample
        # without turning the original 8 px implementation into a CSS contract.
        self.assertGreater(min(profile['heights']), profile['cssHeight'] * 0.1,
                           'Stationary timeline must contain a band, not only a thin baseline')
        self.assertLessEqual(max(profile['heights']) - min(profile['heights']), 1,
                             'Stationary speed band must be flat')
        self.assertIn('原地静止驻留', profile['watermarkText'],
                      'The actual canvas draw must label the stationary state')
        self.assertIn('0.0 km/h', profile['watermarkText'])
        self.assertGreater(profile['watermarkInk'], 20,
                           'The stationary watermark must leave visible central canvas pixels')

    def test_stationary_visible_and_singleton(self):
        # Alter only this context's SDK output, then use the normal assertion.
        if os.environ.get('AIRTRACK_TEST_FAULT') == 'missing-dwell':
            self.page.locator('[data-map-style="dwell_style"]').evaluate('el => el.replaceChildren()')
        if os.environ.get('AIRTRACK_TEST_FAULT') in ('thin-band', 'missing-watermark'):
            self.page.evaluate(r"""fault => {
              const host = document.getElementById('speed-wave-canvas');
              const canvas = host.tagName === 'CANVAS' ? host : host.querySelector('canvas');
              const ctx = canvas.getContext('2d');
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.fillStyle = '#060a17';
              if (fault === 'thin-band') {
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#00f0ff';
                ctx.fillRect(0, canvas.height - 2, canvas.width, 2);
              } else {
                ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);
              }
              ctx.restore();
            }""", os.environ['AIRTRACK_TEST_FAULT'])
        self.assert_stationary()
        self.page.locator('[title="定位至当前设备"]').click()
        expect(self.page.locator('#map-track-loading-capsule')).to_have_count(0)
        self.assert_stationary()
        expect(self.page.locator('[data-map-style="dwell_style"]')).to_have_count(1)

    def test_stationary_moving_stationary_transition(self):
        self.assert_stationary()
        self.page.locator('#mob-tab-dev-990000000000002').click()
        expect(self.page.locator('#live-state-text')).to_have_text('移动中')
        expect(self.page.locator('#live-state-text')).to_be_visible()
        expect(self.page.locator('#live-latest-speed')).to_have_text('24.0 km/h')
        expect(self.page.locator('[data-map-style="dwell_style"] circle')).to_have_count(0)
        lines = self.page.locator('[data-map-layer="line"] polyline')
        expect(lines).to_have_count(8)
        expect(lines.first).to_be_visible()
        profile = self.page.evaluate(CANVAS_PROFILE)
        print(f'{self._testMethodName} moving raster: {profile!a}', flush=True)
        self.assertGreater(max(profile['heights']) - min(profile['heights']), 3,
                           'Moving speeds must produce a varied profile, not a stationary band')
        self.page.locator('#mob-tab-dev-990000000000001').click()
        self.assert_stationary()
        expect(self.page.locator('[data-map-style="dwell_style"]')).to_have_count(1)

    def assert_separate(self, first, second):
        a, b = self.page.locator(first), self.page.locator(second)
        expect(a).to_be_visible()
        expect(b).to_be_visible()
        ar, br = a.bounding_box(), b.bounding_box()
        self.assertIsNotNone(ar)
        self.assertIsNotNone(br)
        print(f'{first}={ar}; {second}={br}', flush=True)
        viewport = self.page.viewport_size
        for label, rect in ((first, ar), (second, br)):
            self.assertGreaterEqual(rect['x'], -0.5, f'{label} outside left viewport edge')
            self.assertGreaterEqual(rect['y'], -0.5, f'{label} outside top viewport edge')
            self.assertLessEqual(rect['x'] + rect['width'], viewport['width'] + 0.5,
                                 f'{label} outside right viewport edge')
            self.assertLessEqual(rect['y'] + rect['height'], viewport['height'] + 0.5,
                                 f'{label} outside bottom viewport edge')
        overlap_x = min(ar['x'] + ar['width'], br['x'] + br['width']) - max(ar['x'], br['x'])
        overlap_y = min(ar['y'] + ar['height'], br['y'] + br['height']) - max(ar['y'], br['y'])
        self.assertFalse(overlap_x > 0 and overlap_y > 0, f'{first} overlaps {second}')

    def check_mobile_layout(self, width, height):
        self.page.set_viewport_size({'width': width, 'height': height})
        if os.environ.get('AIRTRACK_TEST_FAULT') == 'offscreen-control':
            self.page.locator('.mobile-fab-safe').evaluate(
                """el => {
                  el.style.setProperty('transition', 'none', 'important');
                  el.style.setProperty('right', '-200px', 'important');
                }""")
        for target in ('header', '#timeline-hud-capsule', '#inspector-drawer'):
            with self.subTest(control='location button', viewport=(width, height), target=target):
                self.assert_separate('.mobile-fab-safe', target)
        for control in ('.tmap-zoom-control', '.tmap-rotate-control'):
            with self.subTest(control=control, viewport=(width, height)):
                # Missing required controls must not become a skipped/green check.
                self.assert_separate(control, 'header')
                self.assert_separate(control, '.mobile-fab-safe')
        with self.subTest(control='SDK fixture control separation', viewport=(width, height)):
            self.assert_separate('.tmap-zoom-control', '.tmap-rotate-control')

    def test_mobile_controls_393x852(self):
        self.check_mobile_layout(393, 852)

    def test_mobile_controls_360x800(self):
        self.check_mobile_layout(360, 800)


REQUIRED = frozenset({
    'MapUIRegression.test_stationary_visible_and_singleton',
    'MapUIRegression.test_stationary_moving_stationary_transition',
    'MapUIRegression.test_mobile_controls_393x852',
    'MapUIRegression.test_mobile_controls_360x800',
})


def test_ids(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from test_ids(item)
        else:
            yield '.'.join(item.id().split('.')[-2:])


def run_required_suite(suite, required):
    discovered = set(test_ids(suite))
    if not discovered or not required.issubset(discovered):
        print(f'GATE REJECT: discovered={len(discovered)}, missing={sorted(required - discovered)}', file=sys.stderr)
        return 2
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    rejected = (not result.wasSuccessful() or result.testsRun < len(required)
                or bool(result.skipped) or bool(result.expectedFailures))
    print(f'GATE {"REJECT" if rejected else "PASS"}: discovered={len(discovered)}, '
          f'run={result.testsRun}, failures={len(result.failures)}, errors={len(result.errors)}, '
          f'skipped={len(result.skipped)}, expected_failures={len(result.expectedFailures)}', flush=True)
    return 1 if rejected else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gate-probe', choices=('empty', 'all-skipped', 'partial-skipped'))
    parser.add_argument('--fault', choices=('missing-dwell', 'thin-band', 'missing-watermark', 'offscreen-control'))
    args = parser.parse_args()
    if args.gate_probe:
        # Disposable runner-only samples. Business counterexamples use --fault.
        class GateProbe(unittest.TestCase):
            def test_first(self):
                self.skipTest('isolated mandatory-skip probe')

            def test_second(self):
                if args.gate_probe == 'all-skipped':
                    self.skipTest('isolated mandatory-skip probe')

        suite = (unittest.TestSuite() if args.gate_probe == 'empty' else
                 unittest.defaultTestLoader.loadTestsFromTestCase(GateProbe))
        return run_required_suite(suite, {'GateProbe.test_first', 'GateProbe.test_second'})
    if args.fault:
        os.environ['AIRTRACK_TEST_FAULT'] = args.fault
    suite = unittest.TestLoader().discover(str(Path(__file__).parent), pattern='test_*.py')
    return run_required_suite(suite, REQUIRED)


if __name__ == '__main__':
    sys.exit(main())
