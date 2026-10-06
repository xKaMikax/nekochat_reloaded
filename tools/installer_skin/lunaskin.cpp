// Luna skin for the NSIS installer window (build/installer.nsh calls LunaSkinApply through the System plugin).
// It takes the system frame away from the installer's main window and draws the Windows XP Luna frame (title bar with
// the minimize / close buttons, borders), and subclasses the controls of the wizard pages to draw buttons, check boxes,
// radio buttons, group boxes and progress bars from Luna pictures (tools/installer_skin/assets, embedded as resources).
// Build: tools/installer_skin/build.sh -> build/lunaskin.dll (32-bit, like the NSIS installer).
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <objidl.h>
#include <algorithm>
#include <stdarg.h>
using std::min;
using std::max;
#include <gdiplus.h>
#include "skin_ids.h"
using namespace Gdiplus;

static const int FRAME = 5, TITLE = 29, BOTTOM = 5;
static const COLORREF BEIGE = RGB(236, 233, 216);

static HINSTANCE g_inst;
static ULONG_PTR g_gdip;
static Bitmap* g_img[IMG_COUNT + 1];
static HWND g_outer;
static WNDPROC g_outerOld;
static HBRUSH g_beigeBrush;
static bool g_active = true;
static int g_hot, g_down;   // caption buttons: 0 none, 1 minimize, 2 close
static bool g_tracking;

BOOL WINAPI DllMain(HINSTANCE h, DWORD why, LPVOID) {
  if (why == DLL_PROCESS_ATTACH) g_inst = h;
  return TRUE;
}

static Bitmap* Img(int id) {
  if (g_img[id]) return g_img[id];
  HRSRC r = FindResourceW(g_inst, MAKEINTRESOURCEW(id), MAKEINTRESOURCEW(10));
  if (!r) return nullptr;
  DWORD size = SizeofResource(g_inst, r);
  const void* data = LockResource(LoadResource(g_inst, r));
  HGLOBAL mem = GlobalAlloc(GMEM_MOVEABLE, size);
  memcpy(GlobalLock(mem), data, size);
  GlobalUnlock(mem);
  IStream* stream = nullptr;
  if (CreateStreamOnHGlobal(mem, TRUE, &stream) != S_OK) return nullptr;
  Bitmap* loaded = Bitmap::FromStream(stream);
  Bitmap* own = loaded->Clone(0, 0, loaded->GetWidth(), loaded->GetHeight(), PixelFormat32bppPARGB);
  delete loaded;
  stream->Release();
  return g_img[id] = own;
}

static void Draw(Graphics& g, int id, int x, int y, int w, int h, int sx, int sy, int sw, int sh) {
  Bitmap* b = Img(id);
  if (!b || w <= 0 || h <= 0) return;
  ImageAttributes attrs;
  attrs.SetWrapMode(WrapModeTileFlipXY);
  g.DrawImage(b, Rect(x, y, w, h), sx, sy, sw, sh, UnitPixel, &attrs);
}
static void DrawWhole(Graphics& g, int id, int x, int y, int w = -1, int h = -1) {
  Bitmap* b = Img(id);
  if (!b) return;
  int bw = b->GetWidth(), bh = b->GetHeight();
  Draw(g, id, x, y, w < 0 ? bw : w, h < 0 ? bh : h, 0, 0, bw, bh);
}
static void NineSlice(Graphics& g, int id, int x, int y, int w, int h, int m, bool tile = false) {
  Bitmap* b = Img(id);
  if (!b) return;
  int bw = b->GetWidth(), bh = b->GetHeight();
  int sx[4] = {0, m, bw - m, bw}, sy[4] = {0, m, bh - m, bh};
  int dx[4] = {x, x + m, x + w - m, x + w}, dy[4] = {y, y + m, y + h - m, y + h};
  for (int r = 0; r < 3; r++)
    for (int c = 0; c < 3; c++) {
      int cw = dx[c + 1] - dx[c], ch = dy[r + 1] - dy[r], sw = sx[c + 1] - sx[c], sh = sy[r + 1] - sy[r];
      if (tile && c == 1 && sw > 0) {   // the middle repeats (a track), it is not stretched
        for (int t = 0; t < cw; t += sw) Draw(g, id, dx[c] + t, dy[r], min(sw, cw - t), ch, sx[c], sy[r], min(sw, cw - t), sh);
      } else Draw(g, id, dx[c], dy[r], cw, ch, sx[c], sy[r], sw, sh);
    }
}
static void Quality(Graphics& g) {
  g.SetInterpolationMode(InterpolationModeNearestNeighbor);
  g.SetPixelOffsetMode(PixelOffsetModeHalf);
  g.SetCompositingMode(CompositingModeSourceOver);
}

// ---------------------------------------------------------------- the main window's frame
static RECT CaptionButton(int which, int width) {   // 1 minimize, 2 close
  int x = which == 2 ? width - FRAME - 21 : width - FRAME - 21 - 2 - 21;
  RECT r = {x, 5, x + 21, 26};
  return r;
}
static int HitCaption(int x, int y, int width) {
  POINT p = {x, y};
  for (int i = 1; i <= 2; i++) { RECT r = CaptionButton(i, width); if (PtInRect(&r, p)) return i; }
  return 0;
}

static void PaintFrameCore(HDC hdc, int W, int H, const wchar_t* title);
static void PaintFrame(HDC hdc, HWND hwnd) {
  RECT rc; GetClientRect(hwnd, &rc);
  wchar_t title[256]; GetWindowTextW(hwnd, title, 256);
  PaintFrameCore(hdc, rc.right, rc.bottom, title);
}
static void PaintFrameCore(HDC hdc, int W, int H, const wchar_t* title) {
  RECT rc = {0, 0, W, H};
  HDC dc = CreateCompatibleDC(hdc);
  HBITMAP bmp = CreateCompatibleBitmap(hdc, W, H);
  HGDIOBJ oldBmp = SelectObject(dc, bmp);
  FillRect(dc, &rc, g_beigeBrush);
  {
    Graphics g(dc);
    Quality(g);
    int a = g_active ? 0 : 1;
    // sides and bottom: the pictures hold the active state on top, the inactive one below
    // (the sides reach 2 px under the title and 2 px into the bottom: the stretched picture leaves its first row empty)
    Draw(g, IMG_FRAME_LEFT, 0, TITLE - 2, FRAME, H - TITLE - BOTTOM + 4, 0, a * 31, FRAME, 31);
    Draw(g, IMG_FRAME_RIGHT, W - FRAME, TITLE - 2, FRAME, H - TITLE - BOTTOM + 4, 0, a * 31, FRAME, 31);
    Draw(g, IMG_BOTTOM_LEFT, 0, H - BOTTOM, FRAME, BOTTOM, 0, a * 5, FRAME, 5);
    Draw(g, IMG_BOTTOM_FILL, FRAME, H - BOTTOM, W - 2 * FRAME, BOTTOM, 0, a * 5, 39, 5);
    Draw(g, IMG_BOTTOM_RIGHT, W - FRAME, H - BOTTOM, FRAME, BOTTOM, 0, a * 5, FRAME, 5);
    // title bar (over the top of the sides)
    Draw(g, a ? IMG_TITLE_FILL_INACTIVE : IMG_TITLE_FILL, 0, 0, W, TITLE, 0, 0, 3, TITLE);
    DrawWhole(g, a ? IMG_TITLE_LEFT_INACTIVE : IMG_TITLE_LEFT, 0, 0);
    DrawWhole(g, a ? IMG_TITLE_RIGHT_INACTIVE : IMG_TITLE_RIGHT, W - 35, 0);
    DrawWhole(g, IMG_ICON16, 6, 6);
    // caption buttons
    for (int i = 1; i <= 2; i++) {
      RECT r = CaptionButton(i, W);
      int state = g_down == i && g_hot == i ? 2 : g_hot == i ? 1 : 0;
      static const int capIds[3] = {IMG_CAPTION_NORMAL, IMG_CAPTION_HOVER, IMG_CAPTION_PRESSED};
      static const int closeIds[3] = {IMG_CLOSE_NORMAL, IMG_CLOSE_HOVER, IMG_CLOSE_PRESSED};
      static const int glyphCap[3] = {IMG_MINIMIZE_GLYPH_NORMAL, IMG_MINIMIZE_GLYPH_HOVER, IMG_MINIMIZE_GLYPH_PRESSED};
      static const int glyphClose[3] = {IMG_CLOSE_GLYPH_NORMAL, IMG_CLOSE_GLYPH_HOVER, IMG_CLOSE_GLYPH_PRESSED};
      DrawWhole(g, i == 2 ? closeIds[state] : capIds[state], r.left, r.top);
      DrawWhole(g, i == 2 ? glyphClose[state] : glyphCap[state], r.left + 4, r.top + 4);
    }
  }
  // the title: Trebuchet MS bold, white over a dark shadow
  static HFONT font;
  if (!font) font = CreateFontW(-13, 0, 0, 0, FW_BOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Trebuchet MS");
  HGDIOBJ oldFont = SelectObject(dc, font);
  SetBkMode(dc, TRANSPARENT);
  RECT tr = {27, 7, W - 60, 25};
  RECT ts = {28, 8, W - 59, 26};
  SetTextColor(dc, RGB(10, 24, 88));
  DrawTextW(dc, title, -1, &ts, DT_SINGLELINE | DT_NOPREFIX | DT_END_ELLIPSIS);
  SetTextColor(dc, RGB(255, 255, 255));
  DrawTextW(dc, title, -1, &tr, DT_SINGLELINE | DT_NOPREFIX | DT_END_ELLIPSIS);
  SelectObject(dc, oldFont);
  BitBlt(hdc, 0, 0, W, H, dc, 0, 0, SRCCOPY);
  SelectObject(dc, oldBmp);
  DeleteObject(bmp);
  DeleteDC(dc);
}

// the window's outline: a rectangle without the transparent corner pixels of the title bar pictures (the XP rounded top corners)
static void CutCorner(HRGN rgn, int id, bool right, int W) {
  Bitmap* b = Img(id);
  if (!b) return;
  int bw = b->GetWidth(), bh = min((int)b->GetHeight(), TITLE);
  for (int y = 0; y < bh; y++) {
    int run = 0;
    for (int i = 0; i < bw; i++) {
      Color c;
      b->GetPixel(right ? bw - 1 - i : i, y, &c);
      if (c.GetA() > 8) break;
      run++;
    }
    if (!run) continue;
    HRGN cut = CreateRectRgn(right ? W - run : 0, y, right ? W : run, y + 1);
    CombineRgn(rgn, rgn, cut, RGN_DIFF);
    DeleteObject(cut);
  }
}
static void RoundCorners(HWND hwnd) {
  RECT rc; GetClientRect(hwnd, &rc);
  HRGN rgn = CreateRectRgn(0, 0, rc.right, rc.bottom);
  CutCorner(rgn, IMG_TITLE_LEFT, false, rc.right);
  CutCorner(rgn, IMG_TITLE_RIGHT, true, rc.right);
  SetWindowRgn(hwnd, rgn, TRUE);
}

static void InvalidateCaption(HWND hwnd) {
  RECT rc; GetClientRect(hwnd, &rc);
  RECT t = {0, 0, rc.right, TITLE};
  InvalidateRect(hwnd, &t, FALSE);
}

// the colours the dialogs ask for: the default grey becomes the Luna beige, a colour a page chose is kept
static bool IsBtnFaceBrush(LRESULT r) {
  if (!r) return false;
  LOGBRUSH lb;
  return GetObjectW((HBRUSH)r, sizeof lb, &lb) && lb.lbStyle == BS_SOLID && lb.lbColor == GetSysColor(COLOR_BTNFACE);
}
static LRESULT Recolor(LRESULT r, UINT msg, WPARAM wp) {
  if (!IsBtnFaceBrush(r)) return r;
  if (msg != WM_CTLCOLORDLG) SetBkColor((HDC)wp, BEIGE);
  return (LRESULT)g_beigeBrush;
}
static bool IsCtlColor(UINT m) { return m == WM_CTLCOLORDLG || m == WM_CTLCOLORSTATIC || m == WM_CTLCOLORBTN || m == WM_CTLCOLOREDIT || m == WM_CTLCOLORLISTBOX; }

static void Log(const char* fmt, ...) {   // debugging: LUNASKIN_LOG=1 appends to C:\\luna.log
  if (!GetEnvironmentVariableW(L"LUNASKIN_LOG", nullptr, 0)) return;
  char buf[256];
  va_list ap; va_start(ap, fmt);
  int n = wvsprintfA(buf, fmt, ap);
  va_end(ap);
  HANDLE f = CreateFileW(L"C:\\luna.log", FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_ALWAYS, 0, nullptr);
  if (f != INVALID_HANDLE_VALUE) { DWORD w; WriteFile(f, buf, n, &w, nullptr); CloseHandle(f); }
}
static LRESULT CALLBACK OuterProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  RECT rc;
  if (msg == WM_COMMAND || msg >= WM_USER) Log("outer msg=%x wp=%x lp=%x\n", msg, (unsigned)wp, (unsigned)lp);
  switch (msg) {
    case WM_NCHITTEST: {
      POINT p = {(short)LOWORD(lp), (short)HIWORD(lp)};
      ScreenToClient(hwnd, &p);
      GetClientRect(hwnd, &rc);
      if (p.y >= 0 && p.y < TITLE && p.x >= 0 && p.x < rc.right)
        return HitCaption(p.x, p.y, rc.right) ? HTCLIENT : HTCAPTION;
      break;
    }
    case WM_ERASEBKGND:
      PaintFrame((HDC)wp, hwnd);
      return 1;
    case WM_MOUSEMOVE: {
      GetClientRect(hwnd, &rc);
      int hit = HitCaption((short)LOWORD(lp), (short)HIWORD(lp), rc.right);
      if (hit != g_hot) { g_hot = hit; InvalidateCaption(hwnd); }
      if (!g_tracking) {
        TRACKMOUSEEVENT t = {sizeof t, TME_LEAVE, hwnd, 0};
        TrackMouseEvent(&t);
        g_tracking = true;
      }
      break;
    }
    case WM_MOUSELEAVE:
      g_tracking = false;
      if (g_hot && !g_down) { g_hot = 0; InvalidateCaption(hwnd); }
      break;
    case WM_LBUTTONDOWN: {
      GetClientRect(hwnd, &rc);
      int hit = HitCaption((short)LOWORD(lp), (short)HIWORD(lp), rc.right);
      if (hit) { g_down = g_hot = hit; SetCapture(hwnd); InvalidateCaption(hwnd); return 0; }
      break;
    }
    case WM_LBUTTONUP:
      if (g_down) {
        GetClientRect(hwnd, &rc);
        int hit = HitCaption((short)LOWORD(lp), (short)HIWORD(lp), rc.right);
        int was = g_down;
        g_down = 0; g_hot = hit;
        ReleaseCapture();
        InvalidateCaption(hwnd);
        if (hit == was) PostMessageW(hwnd, WM_SYSCOMMAND, was == 2 ? SC_CLOSE : SC_MINIMIZE, 0);
        return 0;
      }
      break;
    case WM_NCACTIVATE:
      g_active = wp != 0;
      InvalidateRect(hwnd, nullptr, FALSE);
      return TRUE;
    case WM_SETTEXT: {
      LRESULT r = CallWindowProcW(g_outerOld, hwnd, msg, wp, lp);
      InvalidateCaption(hwnd);
      return r;
    }
    case WM_SIZE:
      RoundCorners(hwnd);
      InvalidateRect(hwnd, nullptr, TRUE);
      break;
    case WM_CTLCOLORSTATIC: {
      int id = GetDlgCtrlID((HWND)lp);
      if (id == 1028 || id == 1256) {   // the branding text and the line with it: the Luna beige, grey text
        SetBkColor((HDC)wp, BEIGE);
        SetTextColor((HDC)wp, RGB(113, 111, 100));
        return (LRESULT)g_beigeBrush;
      }
      return Recolor(CallWindowProcW(g_outerOld, hwnd, msg, wp, lp), msg, wp);
    }
    default:
      if (IsCtlColor(msg)) return Recolor(CallWindowProcW(g_outerOld, hwnd, msg, wp, lp), msg, wp);
  }
  return CallWindowProcW(g_outerOld, hwnd, msg, wp, lp);
}

// ---------------------------------------------------------------- controls
enum Kind { K_NONE = 0, K_DIALOG = 1, K_PUSH, K_CHECK, K_RADIO, K_GROUP, K_PROGRESS, K_PLAIN };
static const wchar_t* PROP_OLD = L"LunaOld";
static const wchar_t* PROP_KIND = L"LunaKind";
static const wchar_t* PROP_HOT = L"LunaHot";

static HFONT TahomaFor(HWND h) {
  static HFONT cache[2];   // regular, bold
  HFONT cur = (HFONT)SendMessageW(h, WM_GETFONT, 0, 0);
  LOGFONTW lf = {};
  if (!cur || !GetObjectW(cur, sizeof lf, &lf)) return nullptr;
  int slot = lf.lfWeight >= 600 ? 1 : 0;
  if (lf.lfHeight == -11 || (lf.lfHeight > -12 && lf.lfHeight <= 0)) {
    if (!cache[slot]) { lstrcpyW(lf.lfFaceName, L"Tahoma"); cache[slot] = CreateFontIndirectW(&lf); }
    return cache[slot];
  }
  lstrcpyW(lf.lfFaceName, L"Tahoma");   // a bigger font (titles of the first and last page): its own copy
  return CreateFontIndirectW(&lf);
}

static void PaintGroup(HWND hwnd, HDC hdc) {
  RECT rc; GetClientRect(hwnd, &rc);
  int W = rc.right, H = rc.bottom;
  HBRUSH bg = (HBRUSH)SendMessageW(GetParent(hwnd), WM_CTLCOLORBTN, (WPARAM)hdc, (LPARAM)hwnd);
  wchar_t text[256]; GetWindowTextW(hwnd, text, 256);
  HFONT font = (HFONT)SendMessageW(hwnd, WM_GETFONT, 0, 0);
  HGDIOBJ oldFont = font ? SelectObject(hdc, font) : nullptr;
  SIZE ext = {0, 8};
  GetTextExtentPoint32W(hdc, text, lstrlenW(text), &ext);
  int top = ext.cy / 2;
  {
    Graphics g(hdc);
    Pen pen(Color(255, 208, 208, 191));
    g.SetSmoothingMode(SmoothingModeNone);
    g.DrawRectangle(&pen, 0, top, W - 1, H - top - 1);
  }
  RECT tr = {7, 0, 7 + ext.cx + 4, ext.cy + 1};
  FillRect(hdc, &tr, bg ? bg : g_beigeBrush);
  SetBkMode(hdc, TRANSPARENT);
  SetTextColor(hdc, RGB(0, 70, 213));
  OffsetRect(&tr, 2, 0);
  DrawTextW(hdc, text, -1, &tr, DT_SINGLELINE | DT_HIDEPREFIX | DT_NOCLIP);
  if (oldFont) SelectObject(hdc, oldFont);
}

static void PaintButton(HWND hwnd, HDC hdc, int kind) {
  if (kind == K_GROUP) { PaintGroup(hwnd, hdc); return; }
  RECT rc; GetClientRect(hwnd, &rc);
  int W = rc.right, H = rc.bottom;
  HDC dc = CreateCompatibleDC(hdc);
  HBITMAP bmp = CreateCompatibleBitmap(hdc, W, H);
  HGDIOBJ oldBmp = SelectObject(dc, bmp);
  // background and text colour: ask the parent like a normal button does
  HBRUSH bg = (HBRUSH)SendMessageW(GetParent(hwnd), WM_CTLCOLORBTN, (WPARAM)dc, (LPARAM)hwnd);
  FillRect(dc, &rc, bg ? bg : g_beigeBrush);
  COLORREF textColor = GetTextColor(dc);
  bool enabled = IsWindowEnabled(hwnd) != 0;
  LRESULT state = SendMessageW(hwnd, BM_GETSTATE, 0, 0);
  bool pressed = (state & BST_PUSHED) != 0, focused = (state & BST_FOCUS) != 0;
  bool hot = GetPropW(hwnd, PROP_HOT) != nullptr;
  wchar_t text[256]; GetWindowTextW(hwnd, text, 256);
  HFONT font = (HFONT)SendMessageW(hwnd, WM_GETFONT, 0, 0);
  HGDIOBJ oldFont = font ? SelectObject(dc, font) : nullptr;
  SetBkMode(dc, TRANSPARENT);
  {
    Graphics g(dc);
    Quality(g);
    if (kind == K_PUSH) {
      LONG style = GetWindowLongW(hwnd, GWL_STYLE);
      int id = !enabled ? IMG_BUTTON_DISABLED : pressed ? IMG_BUTTON_PRESSED : hot ? IMG_BUTTON_HOT
             : ((style & 0xF) == BS_DEFPUSHBUTTON || focused) ? IMG_BUTTON_DEFAULT : IMG_BUTTON_NORMAL;
      NineSlice(g, id, 0, 0, W, H, 4);
      RECT tr = rc;
      if (pressed) OffsetRect(&tr, 1, 1);
      SetTextColor(dc, enabled ? RGB(0, 0, 0) : RGB(172, 168, 153));
      DrawTextW(dc, text, -1, &tr, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_HIDEPREFIX);
      if (focused) { RECT f = rc; InflateRect(&f, -4, -4); SetTextColor(dc, RGB(0, 0, 0)); DrawFocusRect(dc, &f); }
    } else if (kind == K_CHECK || kind == K_RADIO) {
      bool on = SendMessageW(hwnd, BM_GETCHECK, 0, 0) != BST_UNCHECKED;
      int s = !enabled ? 3 : pressed ? 2 : hot ? 1 : 0;
      static const int check[2][4] = {{IMG_CHECK_OFF_NORMAL, IMG_CHECK_OFF_HOT, IMG_CHECK_OFF_PRESSED, IMG_CHECK_OFF_DISABLED},
                                      {IMG_CHECK_ON_NORMAL, IMG_CHECK_ON_HOT, IMG_CHECK_ON_PRESSED, IMG_CHECK_ON_DISABLED}};
      static const int radio[2][4] = {{IMG_RADIO_OFF_NORMAL, IMG_RADIO_OFF_HOT, IMG_RADIO_OFF_PRESSED, IMG_RADIO_OFF_DISABLED},
                                      {IMG_RADIO_ON_NORMAL, IMG_RADIO_ON_HOT, IMG_RADIO_ON_PRESSED, IMG_RADIO_ON_DISABLED}};
      RECT tr = {18, 0, W, H};
      SetTextColor(dc, enabled ? textColor : RGB(172, 168, 153));
      RECT calc = tr;
      DrawTextW(dc, text, -1, &calc, DT_WORDBREAK | DT_CALCRECT | DT_HIDEPREFIX);
      int th = calc.bottom - calc.top;
      tr.top = max(0, (H - th) / 2); tr.bottom = tr.top + th;
      TEXTMETRICW tm; GetTextMetricsW(dc, &tm);
      DrawWhole(g, (kind == K_CHECK ? check : radio)[on][s], 0, tr.top + (tm.tmHeight - 13) / 2);
      DrawTextW(dc, text, -1, &tr, DT_WORDBREAK | DT_HIDEPREFIX);
      if (focused) { RECT f = {16, tr.top - 1, min((int)W, (int)calc.right + 2), tr.bottom + 1}; DrawFocusRect(dc, &f); }
    } else if (kind == K_GROUP) {
      SIZE ext = {0, 8};
      GetTextExtentPoint32W(dc, text, lstrlenW(text), &ext);
      int top = ext.cy / 2;
      Pen pen(Color(255, 208, 208, 191));
      g.SetSmoothingMode(SmoothingModeNone);
      g.DrawRectangle(&pen, 0, top, W - 1, H - top - 1);
      g.DrawLine(&pen, 1, top - 0, 1, top);   // keeps the corner soft
      RECT tr = {9, 0, W - 9, ext.cy + 1};
      FillRect(dc, &tr, bg ? bg : g_beigeBrush);
      SetTextColor(dc, RGB(0, 70, 213));
      DrawTextW(dc, text, -1, &tr, DT_SINGLELINE | DT_HIDEPREFIX | DT_NOCLIP);
    }
  }
  if (oldFont) SelectObject(dc, oldFont);
  BitBlt(hdc, 0, 0, W, H, dc, 0, 0, SRCCOPY);
  SelectObject(dc, oldBmp);
  DeleteObject(bmp);
  DeleteDC(dc);
}

static void PaintProgress(HWND hwnd, HDC hdc) {
  RECT rc; GetClientRect(hwnd, &rc);
  int W = rc.right, H = rc.bottom;
  struct { int iLow, iHigh; } range = {0, 100};
  SendMessageW(hwnd, 0x0407 /*PBM_GETRANGE*/, TRUE, (LPARAM)&range);
  int lo = range.iLow, hi = range.iHigh, pos = (int)SendMessageW(hwnd, 0x0408 /*PBM_GETPOS*/, 0, 0);
  HDC dc = CreateCompatibleDC(hdc);
  HBITMAP bmp = CreateCompatibleBitmap(hdc, W, H);
  HGDIOBJ oldBmp = SelectObject(dc, bmp);
  HBRUSH bg = (HBRUSH)SendMessageW(GetParent(hwnd), WM_CTLCOLORSTATIC, (WPARAM)dc, (LPARAM)hwnd);
  FillRect(dc, &rc, bg ? bg : g_beigeBrush);
  {
    Graphics g(dc);
    Quality(g);
    NineSlice(g, IMG_PROGRESS_TRACK, 0, 0, W, H, 3, true);
    int inner = W - 6;
    int filled = hi > lo ? (int)((long long)inner * (pos - lo) / (hi - lo)) : 0;
    int ch = 12, y = (H - ch) / 2;
    for (int x = 0; x < filled; x += 10) {
      int w = min(10, filled - x);
      Draw(g, IMG_PROGRESS_CHUNK, 3 + x, y, w, ch, 0, 0, w, ch);
    }
  }
  BitBlt(hdc, 0, 0, W, H, dc, 0, 0, SRCCOPY);
  SelectObject(dc, oldBmp);
  DeleteObject(bmp);
  DeleteDC(dc);
}

static LRESULT CALLBACK CtlProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  WNDPROC old = (WNDPROC)GetPropW(hwnd, PROP_OLD);
  int kind = (int)(INT_PTR)GetPropW(hwnd, PROP_KIND);
  if (!old) return DefWindowProcW(hwnd, msg, wp, lp);
  if (kind == K_DIALOG) {
    if (msg >= WM_USER || msg == WM_COMMAND) {
      LRESULT r = CallWindowProcW(old, hwnd, msg, wp, lp);
      Log("dlg %p msg=%x wp=%x lp=%x -> %x\n", hwnd, msg, (unsigned)wp, (unsigned)lp, (unsigned)r);
      return r;
    }
    if (IsCtlColor(msg)) return Recolor(CallWindowProcW(old, hwnd, msg, wp, lp), msg, wp);
    if (msg == WM_ERASEBKGND) {
      RECT rc; GetClientRect(hwnd, &rc);
      HBRUSH b = (HBRUSH)SendMessageW(hwnd, WM_CTLCOLORDLG, wp, (LPARAM)hwnd);
      FillRect((HDC)wp, &rc, b ? b : g_beigeBrush);
      return 1;
    }
  } else if (kind == K_PUSH || kind == K_CHECK || kind == K_RADIO || kind == K_GROUP) {
    switch (msg) {
      case WM_ERASEBKGND: return 1;
      case WM_PAINT: {
        PAINTSTRUCT ps; HDC hdc = BeginPaint(hwnd, &ps);
        PaintButton(hwnd, hdc, kind);
        EndPaint(hwnd, &ps);
        return 0;
      }
      case WM_PRINTCLIENT: PaintButton(hwnd, (HDC)wp, kind); return 0;
      case WM_MOUSEMOVE:
        if (!GetPropW(hwnd, PROP_HOT)) {
          SetPropW(hwnd, PROP_HOT, (HANDLE)1);
          TRACKMOUSEEVENT t = {sizeof t, TME_LEAVE, hwnd, 0};
          TrackMouseEvent(&t);
          InvalidateRect(hwnd, nullptr, FALSE);
        }
        break;
      case WM_MOUSELEAVE:
        RemovePropW(hwnd, PROP_HOT);
        InvalidateRect(hwnd, nullptr, FALSE);
        break;
      case WM_NCDESTROY: {
        RemovePropW(hwnd, PROP_OLD); RemovePropW(hwnd, PROP_KIND); RemovePropW(hwnd, PROP_HOT);
        return CallWindowProcW(old, hwnd, msg, wp, lp);
      }
      case WM_SETFOCUS: case WM_KILLFOCUS: case WM_ENABLE: case WM_SETTEXT: case BM_SETCHECK: case BM_SETSTATE: case BM_CLICK: {
        LRESULT r = CallWindowProcW(old, hwnd, msg, wp, lp);
        InvalidateRect(hwnd, nullptr, FALSE);
        return r;
      }
    }
  } else if (kind == K_PROGRESS) {
    switch (msg) {
      case WM_ERASEBKGND: return 1;
      case WM_PAINT: {
        PAINTSTRUCT ps; HDC hdc = BeginPaint(hwnd, &ps);
        PaintProgress(hwnd, hdc);
        EndPaint(hwnd, &ps);
        return 0;
      }
      case 0x0402 /*PBM_SETPOS*/: case 0x0404 /*PBM_DELTAPOS*/: case 0x0406 /*PBM_SETRANGE32*/: case 0x0401 /*PBM_SETRANGE*/: {
        LRESULT r = CallWindowProcW(old, hwnd, msg, wp, lp);
        InvalidateRect(hwnd, nullptr, FALSE);
        return r;
      }
    }
  }
  if (msg == WM_NCDESTROY) {
    RemovePropW(hwnd, PROP_OLD); RemovePropW(hwnd, PROP_KIND);
  }
  return CallWindowProcW(old, hwnd, msg, wp, lp);
}

static void Skin(HWND h, int kind) {
  if (kind != K_DIALOG && kind != K_GROUP) SetWindowLongW(h, GWL_STYLE, GetWindowLongW(h, GWL_STYLE) | WS_CLIPSIBLINGS);
  WNDPROC old = (WNDPROC)SetWindowLongPtrW(h, GWLP_WNDPROC, (LONG_PTR)CtlProc);
  SetPropW(h, PROP_OLD, (HANDLE)old);
  SetPropW(h, PROP_KIND, (HANDLE)(INT_PTR)kind);
  InvalidateRect(h, nullptr, TRUE);
}

static bool Off(const wchar_t* name) {   // debugging: LUNASKIN_OFF=ctl,font,frame (a comma list)
  wchar_t v[64];
  if (!GetEnvironmentVariableW(L"LUNASKIN_OFF", v, 64)) return false;
  return wcsstr(v, name) != nullptr;
}
static BOOL CALLBACK ScanChild(HWND h, LPARAM) {
  if (Off(L"all")) return TRUE;
  if (GetPropW(h, PROP_KIND)) return TRUE;
  wchar_t cls[64];
  GetClassNameW(h, cls, 64);
  LONG style = GetWindowLongW(h, GWL_STYLE);
  int kind = K_PLAIN;
  if (!lstrcmpiW(cls, L"#32770")) kind = K_DIALOG;
  else if (!lstrcmpiW(cls, L"Button")) {
    int t = style & 0xF;
    if (style & (BS_BITMAP | BS_ICON)) kind = K_PLAIN;
    else if (t == BS_PUSHBUTTON || t == BS_DEFPUSHBUTTON) kind = K_PUSH;
    else if (t == BS_CHECKBOX || t == BS_AUTOCHECKBOX || t == BS_3STATE || t == BS_AUTO3STATE) kind = K_CHECK;
    else if (t == BS_RADIOBUTTON || t == BS_AUTORADIOBUTTON) kind = K_RADIO;
    else if (t == BS_GROUPBOX) kind = K_GROUP;
  } else if (!lstrcmpiW(cls, L"msctls_progress32")) kind = K_PROGRESS;
  static const wchar_t* names[] = {L"", L"dlg", L"push", L"check", L"radio", L"group", L"prog", L""};
  if (kind != K_PLAIN && !Off(L"ctl") && !Off(names[kind])) Skin(h, kind);
  else SetPropW(h, PROP_KIND, (HANDLE)(INT_PTR)K_PLAIN);
  // Tahoma like Windows XP
  if (!lstrcmpiW(cls, L"Button") || !lstrcmpiW(cls, L"Static") || !lstrcmpiW(cls, L"Edit") || !lstrcmpiW(cls, L"ComboBox")) {
    if (!Off(L"font")) if (HFONT f = TahomaFor(h)) SendMessageW(h, WM_SETFONT, (WPARAM)f, TRUE);
  }
  return TRUE;
}

static void Dump(HWND outer) {
  RECT cr; GetClientRect(outer, &cr);
  Log("client %d x %d\n", cr.right, cr.bottom);
  for (HWND c = GetWindow(outer, GW_CHILD); c; c = GetWindow(c, GW_HWNDNEXT)) {
    RECT r; GetWindowRect(c, &r); MapWindowPoints(nullptr, outer, (POINT*)&r, 2);
    wchar_t cls[32]; GetClassNameW(c, cls, 32);
    char a[32]; WideCharToMultiByte(CP_ACP, 0, cls, -1, a, 32, 0, 0);
    Log("child id=%d %s vis=%d  %d,%d - %d,%d\n", GetDlgCtrlID(c), a, IsWindowVisible(c), r.left, r.top, r.right, r.bottom);
  }
}
// the branding text (version) sits on the separator line: its box is only as wide as the text, so the line goes on past it
static void FitBranding(HWND outer) {
  for (int id : {1028, 1256}) {
    HWND c = GetDlgItem(outer, id);
    if (!c) continue;
    wchar_t text[256]; GetWindowTextW(c, text, 256);
    HDC dc = GetDC(c);
    HGDIOBJ old = SelectObject(dc, (HFONT)SendMessageW(c, WM_GETFONT, 0, 0));
    SIZE ext = {0, 0};
    GetTextExtentPoint32W(dc, text, lstrlenW(text), &ext);
    SelectObject(dc, old);
    ReleaseDC(c, dc);
    RECT r; GetWindowRect(c, &r);
    int want = text[0] ? ext.cx + 6 : 1;
    if (r.right - r.left != want) {
      SetWindowPos(c, HWND_TOP, 0, 0, want, r.bottom - r.top, SWP_NOMOVE | SWP_NOACTIVATE);
      InvalidateRect(outer, nullptr, FALSE);
    }
  }
}
extern "C" __declspec(dllexport) int __stdcall LunaSkinShowFail(HWND outer);
static VOID CALLBACK ScanTimer(HWND, UINT, UINT_PTR, DWORD) {
  static int ticks;
  if (++ticks == 700 && g_outer) Dump(g_outer);
  if (ticks == 500 && g_outer && GetEnvironmentVariableW(L"LUNASKIN_FAILTEST", nullptr, 0)) LunaSkinShowFail(g_outer);
  if (g_outer && IsWindow(g_outer)) { EnumChildWindows(g_outer, ScanChild, 0); FitBranding(g_outer); }
}

// ---------------------------------------------------------------- a failed setup: the sad cat over the page
static LRESULT CALLBACK FailProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  if (msg == WM_ERASEBKGND) return 1;
  if (msg == WM_PAINT) {
    PAINTSTRUCT ps; HDC hdc = BeginPaint(hwnd, &ps);
    RECT rc; GetClientRect(hwnd, &rc);
    int W = rc.right, H = rc.bottom;
    HDC dc = CreateCompatibleDC(hdc);
    HBITMAP bmp = CreateCompatibleBitmap(hdc, W, H);
    HGDIOBJ oldBmp = SelectObject(dc, bmp);
    FillRect(dc, &rc, (HBRUSH)GetStockObject(WHITE_BRUSH));
    {
      Graphics g(dc);
      Quality(g);
      Bitmap* b = Img(IMG_FAIL_SIDE);
      if (b) Draw(g, IMG_FAIL_SIDE, 0, 0, b->GetWidth(), H, 0, 0, b->GetWidth(), b->GetHeight());
    }
    SetBkMode(dc, TRANSPARENT);
    HFONT head = CreateFontW(-17, 0, 0, 0, FW_BOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Tahoma");
    HFONT body = CreateFontW(-11, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Tahoma");
    HGDIOBJ old = SelectObject(dc, head);
    RECT t = {180, 16, W - 14, 70};
    SetTextColor(dc, RGB(0, 0, 0));
    DrawTextW(dc, L"Nekochat Reloaded Setup was not completed", -1, &t, DT_WORDBREAK | DT_NOPREFIX);
    SelectObject(dc, body);
    RECT m = {180, 84, W - 14, H - 10};
    DrawTextW(dc, L"Nekochat Reloaded could not be installed on your computer.\n\nClick Close to exit Setup. You can run the installer again later.", -1, &m, DT_WORDBREAK | DT_NOPREFIX);
    SelectObject(dc, old);
    DeleteObject(head); DeleteObject(body);
    BitBlt(hdc, 0, 0, W, H, dc, 0, 0, SRCCOPY);
    SelectObject(dc, oldBmp); DeleteObject(bmp); DeleteDC(dc);
    EndPaint(hwnd, &ps);
    return 0;
  }
  return DefWindowProcW(hwnd, msg, wp, lp);
}
extern "C" __declspec(dllexport) int __stdcall LunaSkinShowFail(HWND outer) {
  if (!g_outer) return 0;
  static bool registered;
  if (!registered) {
    WNDCLASSW wc = {};
    wc.lpfnWndProc = FailProc; wc.hInstance = g_inst; wc.lpszClassName = L"LunaFail";
    wc.hCursor = LoadCursorW(nullptr, MAKEINTRESOURCEW(32512));
    RegisterClassW(&wc);
    registered = true;
  }
  RECT cr, line;
  GetClientRect(outer, &cr);
  int bottom = cr.bottom - 60;
  for (int id : {1045, 1028, 1256}) {   // above the separator line and the branding text
    if (HWND l = GetDlgItem(outer, id)) { GetWindowRect(l, &line); MapWindowPoints(nullptr, outer, (POINT*)&line, 2); bottom = min(bottom, (int)line.top); }
  }
  HWND w = CreateWindowExW(0, L"LunaFail", L"", WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS, FRAME, TITLE, cr.right - 2 * FRAME, bottom - TITLE, outer, nullptr, g_inst, nullptr);
  SetWindowPos(w, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
  return w != nullptr;
}

// ---------------------------------------------------------------- entry point
extern "C" __declspec(dllexport) int __stdcall LunaSkinApply(HWND outer) {
  if (g_outer) return 1;
  GdiplusStartupInput in;
  if (GdiplusStartup(&g_gdip, &in, nullptr) != Ok) return 0;
  g_beigeBrush = CreateSolidBrush(BEIGE);
  g_outer = outer;
  RECT cr, wr;
  GetClientRect(outer, &cr);
  GetWindowRect(outer, &wr);
  int newW = cr.right + 2 * FRAME, newH = cr.bottom + TITLE + BOTTOM;
  int cx = (wr.left + wr.right) / 2, cy = (wr.top + wr.bottom) / 2;
  // no system frame: the whole window is client area, the frame is painted by OuterProc
  LONG style = GetWindowLongW(outer, GWL_STYLE);
  style &= ~(WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME);
  style |= WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX | WS_CLIPCHILDREN;
  SetWindowLongW(outer, GWL_STYLE, style);
  LONG ex = GetWindowLongW(outer, GWL_EXSTYLE);
  ex &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_WINDOWEDGE | WS_EX_STATICEDGE);
  ex |= WS_EX_APPWINDOW;
  SetWindowLongW(outer, GWL_EXSTYLE, ex);
  for (HWND c = GetWindow(outer, GW_CHILD); c; c = GetWindow(c, GW_HWNDNEXT)) {
    RECT r; GetWindowRect(c, &r);
    MapWindowPoints(nullptr, outer, (POINT*)&r, 2);
    int id = GetDlgCtrlID(c);
    int left = max((int)r.left, 0), right = min((int)r.right, (int)cr.right);   // a line wider than the window is cut to it
    SetWindowPos(c, nullptr, left + FRAME, r.top + TITLE, right - left, r.bottom - r.top, SWP_NOZORDER | SWP_NOACTIVATE);
  }
  g_outerOld = (WNDPROC)SetWindowLongPtrW(outer, GWLP_WNDPROC, (LONG_PTR)OuterProc);
  SetWindowPos(outer, nullptr, cx - newW / 2, cy - newH / 2, newW, newH, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  RoundCorners(outer);
  SetTimer(nullptr, 0, 30, ScanTimer);
  ScanTimer(nullptr, 0, 0, 0);
  InvalidateRect(outer, nullptr, TRUE);
  return 1;
}

// debugging: draws the frame of a W x H window into a 24-bit BMP file (no installer needed)
extern "C" __declspec(dllexport) int __stdcall LunaSkinDumpFrame(const wchar_t* path, int W, int H, int active) {
  GdiplusStartupInput in;
  if (GdiplusStartup(&g_gdip, &in, nullptr) != Ok) return 0;
  g_beigeBrush = CreateSolidBrush(BEIGE);
  g_active = active != 0;
  BITMAPINFO bi = {};
  bi.bmiHeader.biSize = sizeof bi.bmiHeader; bi.bmiHeader.biWidth = W; bi.bmiHeader.biHeight = -H;
  bi.bmiHeader.biPlanes = 1; bi.bmiHeader.biBitCount = 24;
  void* bits = nullptr;
  HDC screen = GetDC(nullptr);
  HDC dc = CreateCompatibleDC(screen);
  HBITMAP bmp = CreateDIBSection(dc, &bi, DIB_RGB_COLORS, &bits, nullptr, 0);
  SelectObject(dc, bmp);
  PaintFrameCore(dc, W, H, L"Nekochat Reloaded Setup");
  GdiFlush();
  int stride = (W * 3 + 3) & ~3;
  BITMAPFILEHEADER fh = {0x4D42, (DWORD)(54 + stride * H), 0, 0, 54};
  bi.bmiHeader.biHeight = -H;   // top-down BMP
  bi.bmiHeader.biSizeImage = stride * H;
  HANDLE f = CreateFileW(path, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
  DWORD w;
  WriteFile(f, &fh, sizeof fh, &w, nullptr);
  WriteFile(f, &bi.bmiHeader, sizeof bi.bmiHeader, &w, nullptr);
  WriteFile(f, bits, stride * H, &w, nullptr);
  CloseHandle(f);
  return 1;
}
