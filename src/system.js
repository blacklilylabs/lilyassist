// Dostęp do Windows przez bibliotekę koffi (bez kompilowania):
// - czy coś teraz gra (poziom dźwięku na domyślnym wyjściu audio),
// - lekkie przesunięcie myszki (żeby ekran nie zgasł).
// Gdy coś pójdzie nie tak, funkcje po prostu nic nie robią.
let api = null;

function init() {
  if (api !== null) return api;
  api = false;
  try {
    const koffi = require('koffi');
    const GUID = koffi.struct('GUID', {
      Data1: 'uint32',
      Data2: 'uint16',
      Data3: 'uint16',
      Data4: koffi.array('uint8', 8),
    });
    const guid = (s) => {
      const h = s.replace(/[{}-]/g, '');
      const b = [];
      for (let i = 16; i < 32; i += 2) b.push(parseInt(h.slice(i, i + 2), 16));
      return { Data1: parseInt(h.slice(0, 8), 16), Data2: parseInt(h.slice(8, 12), 16), Data3: parseInt(h.slice(12, 16), 16), Data4: b };
    };

    const ole32 = koffi.load('ole32.dll');
    const user32 = koffi.load('user32.dll');
    const CoInitializeEx = ole32.func('long __stdcall CoInitializeEx(void *reserved, uint32 coinit)');
    const CoCreateInstance = ole32.func(
      'long __stdcall CoCreateInstance(GUID *clsid, void *outer, uint32 ctx, GUID *iid, _Out_ void **ppv)'
    );
    const mouseEvent = user32.func('void __stdcall mouse_event(uint32 flags, int dx, int dy, uint32 data, uintptr extra)');
    const kernel32 = koffi.load('kernel32.dll');
    const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()');
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hwnd, void *text, int max)');
    const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32 *pid)');
    const OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)');
    const QueryFullProcessImageNameW = kernel32.func(
      'bool __stdcall QueryFullProcessImageNameW(void *process, uint32 flags, void *name, _Inout_ uint32 *size)'
    );
    const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *handle)');
    const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int key)');

    // Tytuł i nazwa programu okna, które jest teraz na wierzchu.
    function foreground() {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return { title: '', exe: '' };
      const text = Buffer.alloc(512 * 2);
      const len = GetWindowTextW(hwnd, text, 512);
      const title = text.toString('utf16le', 0, len * 2);
      const pid = [0];
      GetWindowThreadProcessId(hwnd, pid);
      let exe = '';
      const proc = OpenProcess(0x1000, false, pid[0]); // PROCESS_QUERY_LIMITED_INFORMATION
      if (proc) {
        const name = Buffer.alloc(1024 * 2);
        const size = [1024];
        if (QueryFullProcessImageNameW(proc, 0, name, size)) {
          exe = name.toString('utf16le', 0, size[0] * 2).split('\\').pop().toLowerCase();
        }
        CloseHandle(proc);
      }
      return { title, exe };
    }

    // Wywołanie metody obiektu COM po numerze w jego tablicy metod (vtable).
    const method = (obj, index, proto) => {
      const vtable = koffi.decode(obj, 'void *');
      const fn = koffi.decode(vtable, index * koffi.sizeof('void *'), 'void *');
      return (...args) => koffi.call(fn, proto, obj, ...args);
    };
    const Release = koffi.proto('uint32 __stdcall Release(void *self)');
    const GetDefaultAudioEndpoint = koffi.proto(
      'long __stdcall GetDefaultAudioEndpoint(void *self, int flow, int role, _Out_ void **device)'
    );
    const Activate = koffi.proto(
      'long __stdcall Activate(void *self, GUID *iid, uint32 ctx, void *params, _Out_ void **iface)'
    );
    const GetPeakValue = koffi.proto('long __stdcall GetPeakValue(void *self, _Out_ float *peak)');

    const CLSID_MMDeviceEnumerator = guid('BCDE0395-E52F-467C-8E3D-C4579291692E');
    const IID_IMMDeviceEnumerator = guid('A95664D2-9614-4F35-A746-DE8DB63617E6');
    const IID_IAudioMeterInformation = guid('C02216F6-8C67-4B5B-9D00-D008E73E0064');
    const CLSCTX_ALL = 0x17;

    CoInitializeEx(null, 0x2); // może być już zainicjowane – to nie problem

    // Najwyższy poziom dźwięku na domyślnych głośnikach/słuchawkach (0 = cisza, 1 = max).
    function audioPeak() {
      const enumerator = [null];
      if (CoCreateInstance(CLSID_MMDeviceEnumerator, null, CLSCTX_ALL, IID_IMMDeviceEnumerator, enumerator) < 0) return 0;
      const device = [null];
      const meter = [null];
      const peak = [0];
      try {
        if (method(enumerator[0], 4, GetDefaultAudioEndpoint)(0, 1, device) < 0) return 0; // eRender, eMultimedia
        if (method(device[0], 3, Activate)(IID_IAudioMeterInformation, CLSCTX_ALL, null, meter) < 0) return 0;
        method(meter[0], 3, GetPeakValue)(peak);
        return peak[0];
      } finally {
        if (meter[0]) method(meter[0], 2, Release)();
        if (device[0]) method(device[0], 2, Release)();
        method(enumerator[0], 2, Release)();
      }
    }

    api = {
      audioPeak,
      foreground,
      keyDown: (vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0, // czy klawisz jest teraz wciśnięty
      nudge: (dx, dy) => mouseEvent(0x0001, dx, dy, 0, 0), // MOUSEEVENTF_MOVE (względnie)
    };
  } catch (err) {
    console.warn('Funkcje systemowe niedostępne:', err.message);
  }
  return api;
}

// Czy coś teraz gra (muzyka, film, rozmowa)?
function isAudioPlaying() {
  const a = init();
  if (!a) return false;
  try {
    return a.audioPeak() > 0.001;
  } catch (err) {
    console.warn('Nie udało się sprawdzić dźwięku:', err.message);
    return false;
  }
}

// Przesuwa kursor o kilka pikseli (liczy się jak ruch myszką, więc ekran nie gaśnie).
function nudgeMouse(dx, dy) {
  const a = init();
  if (a) a.nudge(dx, dy);
  return Boolean(a);
}

// Czy na wierzchu jest Claude: aplikacja Claude Desktop, claude.ai w przeglądarce
// albo Claude Code w terminalu (tytuł okna zawiera „Claude”). Nasze okna („LilyAssist”) się nie liczą.
function isClaudeInFront() {
  const a = init();
  if (!a) return false;
  try {
    const { title, exe } = a.foreground();
    if (/lilyassist|codebuddy|octobuddy/i.test(title)) return false;
    return exe === 'claude.exe' || /\bclaude\b/i.test(title);
  } catch {
    return false;
  }
}

// Czy trzymasz jeszcze Ctrl, Alt, Shift albo Windows (np. zaraz po skrócie klawiszowym)?
// Menu otwarte przy wciśniętym Alcie Windows zamyka w chwili puszczenia Alta.
function modifiersHeld() {
  const a = init();
  if (!a) return false;
  try {
    return [0x11, 0x12, 0x10, 0x5b, 0x5c].some((vk) => a.keyDown(vk)); // Ctrl, Alt, Shift, lewy i prawy Win
  } catch {
    return false;
  }
}

module.exports = {
  isAudioPlaying,
  nudgeMouse,
  isClaudeInFront,
  modifiersHeld,
  foreground: () => (init() ? init().foreground() : null),
};
