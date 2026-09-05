use serde::{Deserialize, Serialize};
use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
struct PlatformInfo {
    platform: &'static str,
    version: &'static str,
    background_capable: bool,
}

fn platform_name() -> &'static str {
    #[cfg(target_os = "windows")]
    return "windows";
    #[cfg(target_os = "android")]
    return "android";
    #[cfg(target_os = "ios")]
    return "ios";
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(target_os = "linux")]
    return "linux";
    #[allow(unreachable_code)]
    "unknown"
}

#[tauri::command]
fn jordan_platform() -> PlatformInfo {
    PlatformInfo {
        platform: platform_name(),
        version: env!("CARGO_PKG_VERSION"),
        background_capable: cfg!(desktop),
    }
}

#[tauri::command]
fn minimize_main(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_main(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn show_main(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    let _ = window.unminimize();
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn parse_web_url(raw: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(raw).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        _ => Err("only http/https URLs are allowed".into()),
    }
}

#[tauri::command]
fn open_jordan_webview(app: tauri::AppHandle, url: String, title: Option<String>) -> Result<String, String> {
    let parsed = parse_web_url(&url)?;

    #[cfg(desktop)]
    {
        let label = format!("jordan-web-{}", chrono_like_id());
        WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
            .title(title.unwrap_or_else(|| "JORDAN Browser".into()))
            .inner_size(1120.0, 760.0)
            .min_inner_size(640.0, 480.0)
            .build()
            .map_err(|error| error.to_string())?;
        return Ok("jordan-window".into());
    }

    #[cfg(not(desktop))]
    {
        let _ = title;
        app.opener()
            .open_url(parsed.as_str(), None::<&str>)
            .map_err(|error| error.to_string())?;
        Ok("external".into())
    }
}

fn chrono_like_id() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = parse_web_url(&url)?;
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> bool {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        return app.autolaunch().is_enabled().unwrap_or(false);
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        false
    }
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        let manager = app.autolaunch();
        if enabled {
            manager.enable().map_err(|error| error.to_string())?;
        } else {
            manager.disable().map_err(|error| error.to_string())?;
        }
        return manager.is_enabled().map_err(|error| error.to_string());
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, enabled);
        Ok(false)
    }
}

// -----------------------------------------------------------------------------
// JORDAN AUTOMATION CORE
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
struct AutomationAction {
    kind: String,
    key: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
}

#[derive(Clone, Default)]
struct AutomationRuntime {
    running: Arc<AtomicBool>,
    generation: Arc<AtomicU64>,
    count: Arc<AtomicU64>,
    interval_ms: Arc<AtomicU64>,
    last_error: Arc<Mutex<Option<String>>>,
    action: Arc<Mutex<Option<AutomationAction>>>,
}

#[derive(Serialize)]
struct AutomationCapabilities {
    platform: &'static str,
    native: bool,
    global_input: bool,
    mouse: bool,
    keyboard: bool,
    fixed_screen_tap: bool,
    reason: Option<&'static str>,
}

#[derive(Serialize)]
struct AutomationStatus {
    running: bool,
    count: u64,
    interval_ms: u64,
    last_error: Option<String>,
    action: Option<AutomationAction>,
}

#[derive(Serialize)]
struct CursorPoint {
    x: i32,
    y: i32,
}

fn automation_status_snapshot(runtime: &AutomationRuntime) -> AutomationStatus {
    AutomationStatus {
        running: runtime.running.load(Ordering::SeqCst),
        count: runtime.count.load(Ordering::SeqCst),
        interval_ms: runtime.interval_ms.load(Ordering::SeqCst),
        last_error: runtime.last_error.lock().ok().and_then(|value| value.clone()),
        action: runtime.action.lock().ok().and_then(|value| value.clone()),
    }
}

#[tauri::command]
fn automation_capabilities() -> AutomationCapabilities {
    #[cfg(target_os = "windows")]
    {
        return AutomationCapabilities {
            platform: "windows",
            native: true,
            global_input: true,
            mouse: true,
            keyboard: true,
            fixed_screen_tap: true,
            reason: None,
        };
    }

    #[cfg(target_os = "android")]
    {
        return AutomationCapabilities {
            platform: "android",
            native: true,
            global_input: false,
            mouse: false,
            keyboard: false,
            fixed_screen_tap: false,
            reason: Some("android-accessibility-service-required"),
        };
    }

    #[cfg(target_os = "ios")]
    {
        return AutomationCapabilities {
            platform: "ios",
            native: true,
            global_input: false,
            mouse: false,
            keyboard: false,
            fixed_screen_tap: false,
            reason: Some("ios-global-input-not-available"),
        };
    }

    #[allow(unreachable_code)]
    AutomationCapabilities {
        platform: platform_name(),
        native: true,
        global_input: false,
        mouse: false,
        keyboard: false,
        fixed_screen_tap: false,
        reason: Some("platform-not-implemented"),
    }
}

fn validate_automation_action(action: &AutomationAction) -> Result<(), String> {
    match action.kind.as_str() {
        "mouse_left" | "mouse_right" | "mouse_middle" => Ok(()),
        "screen_tap" => {
            if action.x.is_none() || action.y.is_none() {
                Err("screen_tap requires x and y".into())
            } else {
                Ok(())
            }
        }
        "key" => {
            if action.key.as_deref().unwrap_or("").trim().is_empty() {
                Err("key action requires a key".into())
            } else {
                Ok(())
            }
        }
        _ => Err(format!("unsupported automation action: {}", action.kind)),
    }
}

#[tauri::command]
fn automation_input_once(
    state: tauri::State<'_, AutomationRuntime>,
    action: AutomationAction,
) -> Result<AutomationStatus, String> {
    validate_automation_action(&action)?;
    perform_native_action(&action)?;
    state.count.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut current) = state.action.lock() {
        *current = Some(action);
    }
    if let Ok(mut error) = state.last_error.lock() {
        *error = None;
    }
    Ok(automation_status_snapshot(state.inner()))
}

#[tauri::command]
fn automation_start(
    state: tauri::State<'_, AutomationRuntime>,
    action: AutomationAction,
    interval_ms: u64,
) -> Result<AutomationStatus, String> {
    let capabilities = automation_capabilities();
    if !capabilities.global_input {
        return Err(capabilities.reason.unwrap_or("global input unavailable").into());
    }
    validate_automation_action(&action)?;

    let interval = interval_ms.clamp(25, 3_600_000);
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    state.running.store(true, Ordering::SeqCst);
    state.count.store(0, Ordering::SeqCst);
    state.interval_ms.store(interval, Ordering::SeqCst);
    if let Ok(mut error) = state.last_error.lock() {
        *error = None;
    }
    if let Ok(mut current) = state.action.lock() {
        *current = Some(action.clone());
    }

    let runtime = state.inner().clone();
    thread::spawn(move || {
        while runtime.running.load(Ordering::SeqCst)
            && runtime.generation.load(Ordering::SeqCst) == generation
        {
            if let Err(error) = perform_native_action(&action) {
                if let Ok(mut last) = runtime.last_error.lock() {
                    *last = Some(error);
                }
                runtime.running.store(false, Ordering::SeqCst);
                break;
            }
            runtime.count.fetch_add(1, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(interval));
        }
    });

    Ok(automation_status_snapshot(state.inner()))
}

#[tauri::command]
fn automation_stop(state: tauri::State<'_, AutomationRuntime>) -> AutomationStatus {
    state.running.store(false, Ordering::SeqCst);
    state.generation.fetch_add(1, Ordering::SeqCst);
    automation_status_snapshot(state.inner())
}

#[tauri::command]
fn automation_status(state: tauri::State<'_, AutomationRuntime>) -> AutomationStatus {
    automation_status_snapshot(state.inner())
}

#[tauri::command]
fn automation_cursor_position() -> Result<CursorPoint, String> {
    native_cursor_position()
}

#[cfg(target_os = "windows")]
fn perform_native_action(action: &AutomationAction) -> Result<(), String> {
    windows_input::perform(action)
}

#[cfg(not(target_os = "windows"))]
fn perform_native_action(_action: &AutomationAction) -> Result<(), String> {
    Err(match platform_name() {
        "android" => "Android global input needs the JORDAN Accessibility Service; it is not enabled in this build yet.",
        "ios" => "iOS does not expose arbitrary global touch/key injection to normal apps.",
        _ => "Global automation is not implemented on this platform.",
    }
    .into())
}

#[cfg(target_os = "windows")]
fn native_cursor_position() -> Result<CursorPoint, String> {
    windows_input::cursor_position()
}

#[cfg(not(target_os = "windows"))]
fn native_cursor_position() -> Result<CursorPoint, String> {
    Err("Cursor position is only available in the Windows Automation Core in this build.".into())
}

#[cfg(target_os = "windows")]
mod windows_input {
    use super::{AutomationAction, CursorPoint};
    use std::mem::size_of;

    const INPUT_MOUSE: u32 = 0;
    const INPUT_KEYBOARD: u32 = 1;
    const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
    const MOUSEEVENTF_LEFTUP: u32 = 0x0004;
    const MOUSEEVENTF_RIGHTDOWN: u32 = 0x0008;
    const MOUSEEVENTF_RIGHTUP: u32 = 0x0010;
    const MOUSEEVENTF_MIDDLEDOWN: u32 = 0x0020;
    const MOUSEEVENTF_MIDDLEUP: u32 = 0x0040;
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct MouseInput {
        dx: i32,
        dy: i32,
        mouse_data: u32,
        flags: u32,
        time: u32,
        extra_info: usize,
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct KeyboardInput {
        vk: u16,
        scan: u16,
        flags: u32,
        time: u32,
        extra_info: usize,
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct HardwareInput {
        message: u32,
        param_l: u16,
        param_h: u16,
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    union InputData {
        mouse: MouseInput,
        keyboard: KeyboardInput,
        hardware: HardwareInput,
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct Input {
        input_type: u32,
        data: InputData,
    }

    #[repr(C)]
    #[derive(Copy, Clone)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn SendInput(count: u32, inputs: *const Input, size: i32) -> u32;
        fn SetCursorPos(x: i32, y: i32) -> i32;
        fn GetCursorPos(point: *mut Point) -> i32;
        fn VkKeyScanW(ch: u16) -> i16;
    }

    fn mouse_input(flags: u32) -> Input {
        Input {
            input_type: INPUT_MOUSE,
            data: InputData {
                mouse: MouseInput {
                    dx: 0,
                    dy: 0,
                    mouse_data: 0,
                    flags,
                    time: 0,
                    extra_info: 0,
                },
            },
        }
    }

    fn keyboard_input(vk: u16, key_up: bool) -> Input {
        Input {
            input_type: INPUT_KEYBOARD,
            data: InputData {
                keyboard: KeyboardInput {
                    vk,
                    scan: 0,
                    flags: if key_up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    extra_info: 0,
                },
            },
        }
    }

    fn send(inputs: &[Input]) -> Result<(), String> {
        let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<Input>() as i32) };
        if sent != inputs.len() as u32 {
            return Err(format!("Windows SendInput failed: {}", std::io::Error::last_os_error()));
        }
        Ok(())
    }

    fn click(down: u32, up: u32, x: Option<i32>, y: Option<i32>) -> Result<(), String> {
        if let (Some(x), Some(y)) = (x, y) {
            if unsafe { SetCursorPos(x, y) } == 0 {
                return Err(format!("Windows SetCursorPos failed: {}", std::io::Error::last_os_error()));
            }
        }
        send(&[mouse_input(down), mouse_input(up)])
    }

    fn named_vk(name: &str) -> Option<u16> {
        Some(match name {
            "backspace" | "back" => 0x08,
            "tab" => 0x09,
            "enter" | "return" => 0x0D,
            "shift" => 0x10,
            "ctrl" | "control" => 0x11,
            "alt" => 0x12,
            "pause" => 0x13,
            "capslock" | "caps" => 0x14,
            "esc" | "escape" => 0x1B,
            "space" | "espaco" | "espaço" => 0x20,
            "pageup" => 0x21,
            "pagedown" => 0x22,
            "end" => 0x23,
            "home" => 0x24,
            "left" | "esquerda" => 0x25,
            "up" | "cima" => 0x26,
            "right" | "direita" => 0x27,
            "down" | "baixo" => 0x28,
            "insert" | "ins" => 0x2D,
            "delete" | "del" => 0x2E,
            "win" | "windows" => 0x5B,
            "num0" => 0x60,
            "num1" => 0x61,
            "num2" => 0x62,
            "num3" => 0x63,
            "num4" => 0x64,
            "num5" => 0x65,
            "num6" => 0x66,
            "num7" => 0x67,
            "num8" => 0x68,
            "num9" => 0x69,
            "f1" => 0x70,
            "f2" => 0x71,
            "f3" => 0x72,
            "f4" => 0x73,
            "f5" => 0x74,
            "f6" => 0x75,
            "f7" => 0x76,
            "f8" => 0x77,
            "f9" => 0x78,
            "f10" => 0x79,
            "f11" => 0x7A,
            "f12" => 0x7B,
            _ => return None,
        })
    }

    fn token_vk(token: &str) -> Result<(u16, Vec<u16>), String> {
        let clean = token.trim().to_lowercase();
        if let Some(vk) = named_vk(&clean) {
            return Ok((vk, vec![]));
        }

        let mut chars = clean.chars();
        let ch = chars.next().ok_or("empty key")?;
        if chars.next().is_some() {
            return Err(format!("Unknown key: {token}"));
        }

        if ch.is_ascii_alphabetic() {
            return Ok((ch.to_ascii_uppercase() as u16, vec![]));
        }
        if ch.is_ascii_digit() {
            return Ok((ch as u16, vec![]));
        }

        let mapped = unsafe { VkKeyScanW(ch as u16) };
        if mapped == -1 {
            return Err(format!("Windows cannot map key: {token}"));
        }
        let vk = (mapped as u16) & 0x00ff;
        let shift_state = ((mapped as u16) >> 8) & 0x00ff;
        let mut modifiers = Vec::new();
        if shift_state & 1 != 0 { modifiers.push(0x10); }
        if shift_state & 2 != 0 { modifiers.push(0x11); }
        if shift_state & 4 != 0 { modifiers.push(0x12); }
        Ok((vk, modifiers))
    }

    fn press_key(combo: &str) -> Result<(), String> {
        let tokens: Vec<&str> = combo.split('+').map(str::trim).filter(|value| !value.is_empty()).collect();
        if tokens.is_empty() {
            return Err("empty key".into());
        }

        let mut vks: Vec<u16> = Vec::new();
        for token in tokens {
            let (vk, implicit_modifiers) = token_vk(token)?;
            for modifier in implicit_modifiers {
                if !vks.contains(&modifier) { vks.push(modifier); }
            }
            if !vks.contains(&vk) { vks.push(vk); }
        }

        let mut inputs = Vec::with_capacity(vks.len() * 2);
        for vk in &vks { inputs.push(keyboard_input(*vk, false)); }
        for vk in vks.iter().rev() { inputs.push(keyboard_input(*vk, true)); }
        send(&inputs)
    }

    pub fn perform(action: &AutomationAction) -> Result<(), String> {
        match action.kind.as_str() {
            "mouse_left" => click(MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, action.x, action.y),
            "mouse_right" => click(MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, action.x, action.y),
            "mouse_middle" => click(MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, action.x, action.y),
            "screen_tap" => click(MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, action.x, action.y),
            "key" => press_key(action.key.as_deref().unwrap_or("")),
            other => Err(format!("unsupported Windows automation action: {other}")),
        }
    }

    pub fn cursor_position() -> Result<CursorPoint, String> {
        let mut point = Point { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point as *mut Point) } == 0 {
            return Err(format!("Windows GetCursorPos failed: {}", std::io::Error::last_os_error()));
        }
        Ok(CursorPoint { x: point.x, y: point.y })
    }
}

#[cfg(desktop)]
fn install_desktop_shell(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let _ = app.handle().plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--background"]),
    ));

    let show = MenuItem::with_id(app, "show", "Abrir JORDAN", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Segundo plano", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Encerrar", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("JORDAN")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AutomationRuntime::default())
        .setup(|app| {
            #[cfg(desktop)]
            install_desktop_shell(app)?;

            #[cfg(desktop)]
            if std::env::args().any(|arg| arg == "--background") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            jordan_platform,
            minimize_main,
            hide_main,
            show_main,
            open_jordan_webview,
            open_external_url,
            get_autostart,
            set_autostart,
            automation_capabilities,
            automation_input_once,
            automation_start,
            automation_stop,
            automation_status,
            automation_cursor_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running JORDAN");
}
