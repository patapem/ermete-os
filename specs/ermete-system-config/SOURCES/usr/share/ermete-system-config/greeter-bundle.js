var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../../../../usr/share/astal/gjs/gtk4/index.ts
import Astal6 from "gi://Astal?version=4.0";
import Gtk4 from "gi://Gtk?version=4.0";
import Gdk2 from "gi://Gdk?version=4.0";

// ../../../../../usr/share/astal/gjs/variable.ts
import Astal3 from "gi://AstalIO";

// ../../../../../usr/share/astal/gjs/binding.ts
var snakeify = (str) => str.replace(/([a-z])([A-Z])/g, "$1_$2").replaceAll("-", "_").toLowerCase();
var kebabify = (str) => str.replace(/([a-z])([A-Z])/g, "$1-$2").replaceAll("_", "-").toLowerCase();
var Binding = class _Binding {
  transformFn = (v) => v;
  #emitter;
  #prop;
  static bind(emitter, prop) {
    return new _Binding(emitter, prop);
  }
  constructor(emitter, prop) {
    this.#emitter = emitter;
    this.#prop = prop && kebabify(prop);
  }
  toString() {
    return `Binding<${this.#emitter}${this.#prop ? `, "${this.#prop}"` : ""}>`;
  }
  as(fn) {
    const bind3 = new _Binding(this.#emitter, this.#prop);
    bind3.transformFn = (v) => fn(this.transformFn(v));
    return bind3;
  }
  get() {
    if (typeof this.#emitter.get === "function")
      return this.transformFn(this.#emitter.get());
    if (typeof this.#prop === "string") {
      const getter = `get_${snakeify(this.#prop)}`;
      if (typeof this.#emitter[getter] === "function")
        return this.transformFn(this.#emitter[getter]());
      return this.transformFn(this.#emitter[this.#prop]);
    }
    throw Error("can not get value of binding");
  }
  subscribe(callback) {
    if (typeof this.#emitter.subscribe === "function") {
      return this.#emitter.subscribe(() => {
        callback(this.get());
      });
    } else if (typeof this.#emitter.connect === "function") {
      const signal = `notify::${this.#prop}`;
      const id = this.#emitter.connect(signal, () => {
        callback(this.get());
      });
      return () => {
        this.#emitter.disconnect(id);
      };
    }
    throw Error(`${this.#emitter} is not bindable`);
  }
};
var { bind } = Binding;
var binding_default = Binding;

// ../../../../../usr/share/astal/gjs/time.ts
import Astal from "gi://AstalIO";
var Time = Astal.Time;
function interval(interval2, callback) {
  return Astal.Time.interval(interval2, () => void callback?.());
}

// ../../../../../usr/share/astal/gjs/process.ts
import Astal2 from "gi://AstalIO";
var Process = Astal2.Process;
function subprocess(argsOrCmd, onOut = print, onErr = printerr) {
  const args = Array.isArray(argsOrCmd) || typeof argsOrCmd === "string";
  const { cmd, err, out } = {
    cmd: args ? argsOrCmd : argsOrCmd.cmd,
    err: args ? onErr : argsOrCmd.err || onErr,
    out: args ? onOut : argsOrCmd.out || onOut
  };
  const proc = Array.isArray(cmd) ? Astal2.Process.subprocessv(cmd) : Astal2.Process.subprocess(cmd);
  proc.connect("stdout", (_, stdout) => out(stdout));
  proc.connect("stderr", (_, stderr) => err(stderr));
  return proc;
}
function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    if (Array.isArray(cmd)) {
      Astal2.Process.exec_asyncv(cmd, (_, res) => {
        try {
          resolve(Astal2.Process.exec_asyncv_finish(res));
        } catch (error) {
          reject(error);
        }
      });
    } else {
      Astal2.Process.exec_async(cmd, (_, res) => {
        try {
          resolve(Astal2.Process.exec_finish(res));
        } catch (error) {
          reject(error);
        }
      });
    }
  });
}

// ../../../../../usr/share/astal/gjs/variable.ts
var VariableWrapper = class extends Function {
  variable;
  errHandler = console.error;
  _value;
  _poll;
  _watch;
  pollInterval = 1e3;
  pollExec;
  pollTransform;
  pollFn;
  watchTransform;
  watchExec;
  constructor(init) {
    super();
    this._value = init;
    this.variable = new Astal3.VariableBase();
    this.variable.connect("dropped", () => {
      this.stopWatch();
      this.stopPoll();
    });
    this.variable.connect("error", (_, err) => this.errHandler?.(err));
    return new Proxy(this, {
      apply: (target, _, args) => target._call(args[0])
    });
  }
  _call(transform) {
    const b = binding_default.bind(this);
    return transform ? b.as(transform) : b;
  }
  toString() {
    return String(`Variable<${this.get()}>`);
  }
  get() {
    return this._value;
  }
  set(value) {
    if (value !== this._value) {
      this._value = value;
      this.variable.emit("changed");
    }
  }
  startPoll() {
    if (this._poll)
      return;
    if (this.pollFn) {
      this._poll = interval(this.pollInterval, () => {
        const v = this.pollFn(this.get());
        if (v instanceof Promise) {
          v.then((v2) => this.set(v2)).catch((err) => this.variable.emit("error", err));
        } else {
          this.set(v);
        }
      });
    } else if (this.pollExec) {
      this._poll = interval(this.pollInterval, () => {
        execAsync(this.pollExec).then((v) => this.set(this.pollTransform(v, this.get()))).catch((err) => this.variable.emit("error", err));
      });
    }
  }
  startWatch() {
    if (this._watch)
      return;
    this._watch = subprocess({
      cmd: this.watchExec,
      out: (out) => this.set(this.watchTransform(out, this.get())),
      err: (err) => this.variable.emit("error", err)
    });
  }
  stopPoll() {
    this._poll?.cancel();
    delete this._poll;
  }
  stopWatch() {
    this._watch?.kill();
    delete this._watch;
  }
  isPolling() {
    return !!this._poll;
  }
  isWatching() {
    return !!this._watch;
  }
  drop() {
    this.variable.emit("dropped");
  }
  onDropped(callback) {
    this.variable.connect("dropped", callback);
    return this;
  }
  onError(callback) {
    delete this.errHandler;
    this.variable.connect("error", (_, err) => callback(err));
    return this;
  }
  subscribe(callback) {
    const id = this.variable.connect("changed", () => {
      callback(this.get());
    });
    return () => this.variable.disconnect(id);
  }
  poll(interval2, exec, transform = (out) => out) {
    this.stopPoll();
    this.pollInterval = interval2;
    this.pollTransform = transform;
    if (typeof exec === "function") {
      this.pollFn = exec;
      delete this.pollExec;
    } else {
      this.pollExec = exec;
      delete this.pollFn;
    }
    this.startPoll();
    return this;
  }
  watch(exec, transform = (out) => out) {
    this.stopWatch();
    this.watchExec = exec;
    this.watchTransform = transform;
    this.startWatch();
    return this;
  }
  observe(objs, sigOrFn, callback) {
    const f = typeof sigOrFn === "function" ? sigOrFn : callback ?? (() => this.get());
    const set = (obj, ...args) => this.set(f(obj, ...args));
    if (Array.isArray(objs)) {
      for (const obj of objs) {
        const [o, s] = obj;
        const id = o.connect(s, set);
        this.onDropped(() => o.disconnect(id));
      }
    } else {
      if (typeof sigOrFn === "string") {
        const id = objs.connect(sigOrFn, set);
        this.onDropped(() => objs.disconnect(id));
      }
    }
    return this;
  }
  static derive(deps, fn = (...args) => args) {
    const update = () => fn(...deps.map((d) => d.get()));
    const derived = new Variable(update());
    const unsubs = deps.map((dep) => dep.subscribe(() => derived.set(update())));
    derived.onDropped(() => unsubs.map((unsub) => unsub()));
    return derived;
  }
};
var Variable = new Proxy(VariableWrapper, {
  apply: (_t, _a, args) => new VariableWrapper(args[0])
});
var { derive } = Variable;
var variable_default = Variable;

// ../../../../../usr/share/astal/gjs/_astal.ts
var noImplicitDestroy = Symbol("no no implicit destroy");
var setChildren = Symbol("children setter method");
function mergeBindings(array) {
  function getValues(...args) {
    let i = 0;
    return array.map(
      (value) => value instanceof binding_default ? args[i++] : value
    );
  }
  const bindings = array.filter((i) => i instanceof binding_default);
  if (bindings.length === 0)
    return array;
  if (bindings.length === 1)
    return bindings[0].as(getValues);
  return variable_default.derive(bindings, getValues)();
}
function setProp(obj, prop, value) {
  try {
    const setter = `set_${snakeify(prop)}`;
    if (typeof obj[setter] === "function")
      return obj[setter](value);
    return obj[prop] = value;
  } catch (error) {
    console.error(`could not set property "${prop}" on ${obj}:`, error);
  }
}
function construct(widget, config) {
  let { setup, child, children = [], ...props } = config;
  if (children instanceof binding_default) {
    children = [children];
  }
  if (child) {
    children.unshift(child);
  }
  for (const [key, value] of Object.entries(props)) {
    if (value === void 0) {
      delete props[key];
    }
  }
  const bindings = Object.keys(props).reduce((acc, prop) => {
    if (props[prop] instanceof binding_default) {
      const binding = props[prop];
      delete props[prop];
      return [...acc, [prop, binding]];
    }
    return acc;
  }, []);
  const onHandlers = Object.keys(props).reduce((acc, key) => {
    if (key.startsWith("on")) {
      const sig = kebabify(key).split("-").slice(1).join("-");
      const handler = props[key];
      delete props[key];
      return [...acc, [sig, handler]];
    }
    return acc;
  }, []);
  const mergedChildren = mergeBindings(children.flat(Infinity));
  if (mergedChildren instanceof binding_default) {
    widget[setChildren](mergedChildren.get());
    widget.connect("destroy", mergedChildren.subscribe((v) => {
      widget[setChildren](v);
    }));
  } else {
    if (mergedChildren.length > 0) {
      widget[setChildren](mergedChildren);
    }
  }
  for (const [signal, callback] of onHandlers) {
    const sig = signal.startsWith("notify") ? signal.replace("-", "::") : signal;
    if (typeof callback === "function") {
      widget.connect(sig, callback);
    } else {
      widget.connect(sig, () => execAsync(callback).then(print).catch(console.error));
    }
  }
  for (const [prop, binding] of bindings) {
    if (prop === "child" || prop === "children") {
      widget.connect("destroy", binding.subscribe((v) => {
        widget[setChildren](v);
      }));
    }
    widget.connect("destroy", binding.subscribe((v) => {
      setProp(widget, prop, v);
    }));
    setProp(widget, prop, binding.get());
  }
  for (const [key, value] of Object.entries(props)) {
    if (value === void 0) {
      delete props[key];
    }
  }
  Object.assign(widget, props);
  setup?.(widget);
  return widget;
}

// ../../../../../usr/share/astal/gjs/gtk4/astalify.ts
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
var type = Symbol("child type");
var dummyBulder = new Gtk.Builder();
function _getChildren(widget) {
  if ("get_child" in widget && typeof widget.get_child == "function") {
    return widget.get_child() ? [widget.get_child()] : [];
  }
  const children = [];
  let ch = widget.get_first_child();
  while (ch !== null) {
    children.push(ch);
    ch = ch.get_next_sibling();
  }
  return children;
}
function _setChildren(widget, children) {
  children = children.flat(Infinity).map((ch) => ch instanceof Gtk.Widget ? ch : new Gtk.Label({ visible: true, label: String(ch) }));
  for (const child of children) {
    widget.vfunc_add_child(
      dummyBulder,
      child,
      type in child ? child[type] : null
    );
  }
}
function astalify(cls, config = {}) {
  Object.assign(cls.prototype, {
    [setChildren](children) {
      const w = this;
      for (const child of config.getChildren?.(w) || _getChildren(w)) {
        if (child instanceof Gtk.Widget) {
          child.unparent();
          if (!children.includes(child) && noImplicitDestroy in this)
            child.run_dispose();
        }
      }
      if (config.setChildren) {
        config.setChildren(w, children);
      } else {
        _setChildren(w, children);
      }
    }
  });
  return {
    [cls.name]: (props = {}, ...children) => {
      const widget = new cls("cssName" in props ? { cssName: props.cssName } : {});
      if ("cssName" in props) {
        delete props.cssName;
      }
      if (props.noImplicitDestroy) {
        Object.assign(widget, { [noImplicitDestroy]: true });
        delete props.noImplicitDestroy;
      }
      if (props.type) {
        Object.assign(widget, { [type]: props.type });
        delete props.type;
      }
      if (children.length > 0) {
        Object.assign(props, { children });
      }
      return construct(widget, setupControllers(widget, props));
    }
  }[cls.name];
}
function setupControllers(widget, {
  onFocusEnter,
  onFocusLeave,
  onKeyPressed,
  onKeyReleased,
  onKeyModifier,
  onLegacy,
  onButtonPressed,
  onButtonReleased,
  onHoverEnter,
  onHoverLeave,
  onMotion,
  onScroll,
  onScrollDecelerate,
  ...props
}) {
  if (onFocusEnter || onFocusLeave) {
    const focus = new Gtk.EventControllerFocus();
    widget.add_controller(focus);
    if (onFocusEnter)
      focus.connect("enter", () => onFocusEnter(widget));
    if (onFocusLeave)
      focus.connect("leave", () => onFocusLeave(widget));
  }
  if (onKeyPressed || onKeyReleased || onKeyModifier) {
    const key = new Gtk.EventControllerKey();
    widget.add_controller(key);
    if (onKeyPressed)
      key.connect("key-pressed", (_, val, code, state) => onKeyPressed(widget, val, code, state));
    if (onKeyReleased)
      key.connect("key-released", (_, val, code, state) => onKeyReleased(widget, val, code, state));
    if (onKeyModifier)
      key.connect("modifiers", (_, state) => onKeyModifier(widget, state));
  }
  if (onLegacy || onButtonPressed || onButtonReleased) {
    const legacy = new Gtk.EventControllerLegacy();
    widget.add_controller(legacy);
    legacy.connect("event", (_, event) => {
      if (event.get_event_type() === Gdk.EventType.BUTTON_PRESS) {
        onButtonPressed?.(widget, event);
      }
      if (event.get_event_type() === Gdk.EventType.BUTTON_RELEASE) {
        onButtonReleased?.(widget, event);
      }
      onLegacy?.(widget, event);
    });
  }
  if (onMotion || onHoverEnter || onHoverLeave) {
    const hover = new Gtk.EventControllerMotion();
    widget.add_controller(hover);
    if (onHoverEnter)
      hover.connect("enter", (_, x, y) => onHoverEnter(widget, x, y));
    if (onHoverLeave)
      hover.connect("leave", () => onHoverLeave(widget));
    if (onMotion)
      hover.connect("motion", (_, x, y) => onMotion(widget, x, y));
  }
  if (onScroll || onScrollDecelerate) {
    const scroll = new Gtk.EventControllerScroll();
    scroll.flags = Gtk.EventControllerScrollFlags.BOTH_AXES | Gtk.EventControllerScrollFlags.KINETIC;
    widget.add_controller(scroll);
    if (onScroll)
      scroll.connect("scroll", (_, x, y) => onScroll(widget, x, y));
    if (onScrollDecelerate)
      scroll.connect("decelerate", (_, x, y) => onScrollDecelerate(widget, x, y));
  }
  return props;
}

// ../../../../../usr/share/astal/gjs/gtk4/app.ts
import GLib from "gi://GLib?version=2.0";
import Gtk2 from "gi://Gtk?version=4.0";
import Astal4 from "gi://Astal?version=4.0";

// ../../../../../usr/share/astal/gjs/overrides.ts
var snakeify2 = (str) => str.replace(/([a-z])([A-Z])/g, "$1_$2").replaceAll("-", "_").toLowerCase();
async function suppress(mod, patch2) {
  return mod.then((m) => patch2(m.default)).catch(() => void 0);
}
function patch(proto, prop) {
  Object.defineProperty(proto, prop, {
    get() {
      return this[`get_${snakeify2(prop)}`]();
    }
  });
}
await suppress(import("gi://AstalApps"), ({ Apps, Application }) => {
  patch(Apps.prototype, "list");
  patch(Application.prototype, "keywords");
  patch(Application.prototype, "categories");
});
await suppress(import("gi://AstalBattery"), ({ UPower }) => {
  patch(UPower.prototype, "devices");
});
await suppress(import("gi://AstalBluetooth"), ({ Adapter, Bluetooth, Device }) => {
  patch(Adapter.prototype, "uuids");
  patch(Bluetooth.prototype, "adapters");
  patch(Bluetooth.prototype, "devices");
  patch(Device.prototype, "uuids");
});
await suppress(import("gi://AstalHyprland"), ({ Hyprland, Monitor, Workspace }) => {
  patch(Hyprland.prototype, "binds");
  patch(Hyprland.prototype, "monitors");
  patch(Hyprland.prototype, "workspaces");
  patch(Hyprland.prototype, "clients");
  patch(Monitor.prototype, "availableModes");
  patch(Monitor.prototype, "available_modes");
  patch(Workspace.prototype, "clients");
});
await suppress(import("gi://AstalMpris"), ({ Mpris, Player }) => {
  patch(Mpris.prototype, "players");
  patch(Player.prototype, "supported_uri_schemes");
  patch(Player.prototype, "supportedUriSchemes");
  patch(Player.prototype, "supported_mime_types");
  patch(Player.prototype, "supportedMimeTypes");
  patch(Player.prototype, "comments");
});
await suppress(import("gi://AstalNetwork"), ({ Wifi }) => {
  patch(Wifi.prototype, "access_points");
  patch(Wifi.prototype, "accessPoints");
});
await suppress(import("gi://AstalNotifd"), ({ Notifd, Notification }) => {
  patch(Notifd.prototype, "notifications");
  patch(Notification.prototype, "actions");
});
await suppress(import("gi://AstalPowerProfiles"), ({ PowerProfiles }) => {
  patch(PowerProfiles.prototype, "actions");
});
await suppress(import("gi://AstalWp"), ({ Wp, Audio, Video }) => {
  patch(Wp.prototype, "endpoints");
  patch(Wp.prototype, "devices");
  patch(Audio.prototype, "streams");
  patch(Audio.prototype, "recorders");
  patch(Audio.prototype, "microphones");
  patch(Audio.prototype, "speakers");
  patch(Audio.prototype, "devices");
  patch(Video.prototype, "streams");
  patch(Video.prototype, "recorders");
  patch(Video.prototype, "sinks");
  patch(Video.prototype, "sources");
  patch(Video.prototype, "devices");
});

// ../../../../../usr/share/astal/gjs/_app.ts
import { setConsoleLogDomain } from "console";
import { exit, programArgs } from "system";
import IO from "gi://AstalIO";
import GObject from "gi://GObject";
function mkApp(App3) {
  return new class AstalJS extends App3 {
    static {
      GObject.registerClass({ GTypeName: "AstalJS" }, this);
    }
    eval(body) {
      return new Promise((res, rej) => {
        try {
          const fn = Function(`return (async function() {
                        ${body.includes(";") ? body : `return ${body};`}
                    })`);
          fn()().then(res).catch(rej);
        } catch (error) {
          rej(error);
        }
      });
    }
    requestHandler;
    vfunc_request(msg, conn) {
      if (typeof this.requestHandler === "function") {
        this.requestHandler(msg, (response) => {
          IO.write_sock(
            conn,
            String(response),
            (_, res) => IO.write_sock_finish(res)
          );
        });
      } else {
        super.vfunc_request(msg, conn);
      }
    }
    apply_css(style, reset = false) {
      super.apply_css(style, reset);
    }
    quit(code) {
      super.quit();
      exit(code ?? 0);
    }
    start({ requestHandler, css, hold, main, client, icons, ...cfg } = {}) {
      const app = this;
      client ??= () => {
        print(`Astal instance "${app.instanceName}" already running`);
        exit(1);
      };
      Object.assign(this, cfg);
      setConsoleLogDomain(app.instanceName);
      this.requestHandler = requestHandler;
      app.connect("activate", () => {
        main?.(...programArgs);
      });
      try {
        app.acquire_socket();
      } catch (error) {
        return client((msg) => IO.send_request(app.instanceName, msg), ...programArgs);
      }
      if (css)
        this.apply_css(css, false);
      if (icons)
        app.add_icons(icons);
      hold ??= true;
      if (hold)
        app.hold();
      app.runAsync([]);
    }
  }();
}

// ../../../../../usr/share/astal/gjs/gtk4/app.ts
Gtk2.init();
GLib.unsetenv("LD_PRELOAD");
await import("gi://Adw?version=1").then(({ default: Adw }) => Adw.init()).catch(() => void 0);
var app_default = mkApp(Astal4.Application);

// ../../../../../usr/share/astal/gjs/gtk4/widget.ts
var widget_exports = {};
__export(widget_exports, {
  Box: () => Box,
  Button: () => Button,
  CenterBox: () => CenterBox,
  Entry: () => Entry,
  Image: () => Image,
  Label: () => Label,
  LevelBar: () => LevelBar,
  MenuButton: () => MenuButton,
  Overlay: () => Overlay,
  Popover: () => Popover,
  Revealer: () => Revealer,
  Slider: () => Slider,
  Stack: () => Stack,
  Switch: () => Switch,
  Window: () => Window
});
import Astal5 from "gi://Astal?version=4.0";
import Gtk3 from "gi://Gtk?version=4.0";
function filter(children) {
  return children.flat(Infinity).map((ch) => ch instanceof Gtk3.Widget ? ch : new Gtk3.Label({ visible: true, label: String(ch) }));
}
Object.defineProperty(Astal5.Box.prototype, "children", {
  get() {
    return this.get_children();
  },
  set(v) {
    this.set_children(v);
  }
});
var Box = astalify(Astal5.Box, {
  getChildren(self) {
    return self.get_children();
  },
  setChildren(self, children) {
    return self.set_children(filter(children));
  }
});
var Button = astalify(Gtk3.Button);
var CenterBox = astalify(Gtk3.CenterBox, {
  getChildren(box) {
    return [box.startWidget, box.centerWidget, box.endWidget];
  },
  setChildren(box, children) {
    const ch = filter(children);
    box.startWidget = ch[0] || new Gtk3.Box();
    box.centerWidget = ch[1] || new Gtk3.Box();
    box.endWidget = ch[2] || new Gtk3.Box();
  }
});
var Entry = astalify(Gtk3.Entry, {
  getChildren() {
    return [];
  }
});
var Image = astalify(Gtk3.Image, {
  getChildren() {
    return [];
  }
});
var Label = astalify(Gtk3.Label, {
  getChildren() {
    return [];
  },
  setChildren(self, children) {
    self.label = String(children);
  }
});
var LevelBar = astalify(Gtk3.LevelBar, {
  getChildren() {
    return [];
  }
});
var Overlay = astalify(Gtk3.Overlay, {
  getChildren(self) {
    const children = [];
    let ch = self.get_first_child();
    while (ch !== null) {
      children.push(ch);
      ch = ch.get_next_sibling();
    }
    return children.filter((ch2) => ch2 !== self.child);
  },
  setChildren(self, children) {
    for (const child of filter(children)) {
      const types = type in child ? child[type].split(/\s+/) : [];
      if (types.includes("overlay")) {
        self.add_overlay(child);
      } else {
        self.set_child(child);
      }
      self.set_measure_overlay(child, types.includes("measure"));
      self.set_clip_overlay(child, types.includes("clip"));
    }
  }
});
var Revealer = astalify(Gtk3.Revealer);
var Slider = astalify(Astal5.Slider, {
  getChildren() {
    return [];
  }
});
var Stack = astalify(Gtk3.Stack, {
  setChildren(self, children) {
    for (const child of filter(children)) {
      if (child.name != "" && child.name != null) {
        self.add_named(child, child.name);
      } else {
        self.add_child(child);
      }
    }
  }
});
var Switch = astalify(Gtk3.Switch, {
  getChildren() {
    return [];
  }
});
var Window = astalify(Astal5.Window);
var MenuButton = astalify(Gtk3.MenuButton, {
  getChildren(self) {
    return [self.popover, self.child];
  },
  setChildren(self, children) {
    for (const child of filter(children)) {
      if (child instanceof Gtk3.Popover) {
        self.set_popover(child);
      } else {
        self.set_child(child);
      }
    }
  }
});
var Popover = astalify(Gtk3.Popover);

// ../../../../../usr/share/astal/gjs/index.ts
import { default as default3 } from "gi://AstalIO?version=0.1";

// ../../../../../usr/share/astal/gjs/file.ts
import Astal7 from "gi://AstalIO";
import Gio from "gi://Gio?version=2.0";

// ../../../../../usr/share/astal/gjs/gobject.ts
import GObject2 from "gi://GObject";
import { default as default2 } from "gi://GLib?version=2.0";
var meta = Symbol("meta");
var priv = Symbol("priv");
var { ParamSpec, ParamFlags } = GObject2;

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/state.ts
import AstalApps from "gi://AstalApps";
import AstalWp from "gi://AstalWp";
import AstalMpris from "gi://AstalMpris";
import AstalTray from "gi://AstalTray";
function PopupWindow(args) {
  const { name, anchor, child, marginTop = 0, marginRight = 0, marginLeft = 0, marginBottom = 0 } = args;
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal6.WindowAnchor;
  let halign = Gtk4.Align.CENTER;
  let valign = Gtk4.Align.CENTER;
  if (anchor & LEFT) halign = Gtk4.Align.START;
  else if (anchor & RIGHT) halign = Gtk4.Align.END;
  if (anchor & TOP) valign = Gtk4.Align.START;
  else if (anchor & BOTTOM) valign = Gtk4.Align.END;
  let clickedInside = false;
  return widget_exports.Window({
    name,
    namespace: name,
    application: app_default,
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    layer: Astal6.Layer.TOP,
    child: widget_exports.Overlay({
      child: widget_exports.Box({
        expand: true,
        css_classes: ["modal-bg-barrier"],
        setup: (self) => {
          const click = new Gtk4.GestureClick();
          click.connect("released", () => {
            if (!clickedInside) {
              const win = app_default.get_window(name);
              if (win && win.visible) win.visible = false;
            }
            clickedInside = false;
          });
          self.add_controller(click);
        }
      }),
      setup: (self) => {
        const innerBox = widget_exports.Box({
          halign,
          valign,
          marginTop,
          marginRight,
          marginLeft,
          marginBottom,
          setup: (inner) => {
            const innerClick = new Gtk4.GestureClick();
            innerClick.connect("pressed", () => {
              clickedInside = true;
            });
            inner.add_controller(innerClick);
          },
          child
        });
        self.add_overlay(innerBox);
      }
    })
  });
}
var timeState = Variable("00:00");
var dateState = Variable("Dom 1 Gen");
var uptimeState = Variable("0h 0m");
var cpuUsage = Variable("0%");
var ramUsage = Variable("0%");
var caffeineState = Variable(false);
var wifiState = Variable("Scansione...");
var btState = Variable("Off");
var isPlaying = Variable(false);
var mediaTrack = Variable("Nessun media");
var niriWorkspaces = Variable("[]");
var volState = Variable("VOL \u2022 80%");
var volVal = Variable(80).poll(2e3, () => {
  const out = execSync("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null");
  if (!out) return 80;
  if (out.includes("[MUTED]")) return 0;
  const match = out.match(/Volume:\s+([0-9.]+)/);
  return match ? Math.round(parseFloat(match[1]) * 100) : 80;
});
var micVal = Variable(70).poll(3e3, () => {
  const out = execSync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@ 2>/dev/null");
  if (!out) return 70;
  if (out.includes("[MUTED]")) return 0;
  const match = out.match(/Volume:\s+([0-9.]+)/);
  return match ? Math.round(parseFloat(match[1]) * 100) : 70;
});
var brightVal = Variable(90);
var battState = Variable("PWR \u2022 95%");
var mediaArtist = Variable("Ermete Media");
var diskUsage = Variable("45 GB");
var wifiExpanded = Variable(true);
var btExpanded = Variable(true);
var wifiList = Variable([]);
var btList = Variable([]);
var audioSinks = Variable([]);
var audioSources = Variable([]);
var appStreams = Variable([]);
var decoder = new TextDecoder();
function execSync(cmd) {
  try {
    const escapedCmd = cmd.replace(/'/g, "'\\''");
    const res = default2.spawn_command_line_sync(`sh -c '${escapedCmd}'`);
    if (res[0] && res[1]) {
      return decoder.decode(res[1]).trim();
    }
  } catch {
  }
  return "";
}
var allModals = ["wifi-modal", "bt-modal", "audio-modal", "quick-settings", "sys-monitor", "media-player", "calendar", "launcher", "powermenu", "spotlight"];
var lastFocusLoss = 0;
function toggleExclusiveModal(name) {
  if (Date.now() - lastFocusLoss < 150) return;
  const win = app_default.get_window(name);
  if (win && win.visible) {
    win.visible = false;
  } else {
    allModals.forEach((m) => {
      if (m !== name) {
        const w = app_default.get_window(m);
        if (w && w.visible) w.visible = false;
      }
    });
    if (win) win.visible = true;
  }
}
setInterval(() => {
  timeState.set(default2.DateTime.new_now_local().format("%H:%M") || "00:00");
}, 1e3);
setInterval(() => {
  dateState.set(default2.DateTime.new_now_local().format("%a %d %b") || "");
}, 6e4);
setInterval(() => {
  execAsync("uptime -p").then((out) => uptimeState.set(out.replace("up ", "UP ") || "UP Active")).catch(() => {
  });
}, 6e4);
setInterval(() => {
  execAsync(["sh", "-c", "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'"]).then((out) => {
    cpuUsage.set(`${Math.round(parseFloat(out))}%`);
  }).catch(() => {
  });
}, 3e3);
setInterval(() => {
  execAsync(["sh", "-c", "free -m | grep Mem | awk '{print $3}'"]).then((out) => {
    const gb = (parseInt(out) / 1024).toFixed(1);
    ramUsage.set(!isNaN(parseFloat(gb)) ? `${gb} GB` : "3.2 GB");
  }).catch(() => {
  });
}, 5e3);
setInterval(() => {
  execAsync(["sh", "-c", "df -h / | tail -1 | awk '{print $4}'"]).then((out) => {
    diskUsage.set(out || "40 GB");
  }).catch(() => {
  });
}, 3e4);
setInterval(() => {
  execAsync(["cat", "/sys/class/power_supply/BAT0/capacity"]).then((cap) => {
    execAsync(["cat", "/sys/class/power_supply/BAT0/status"]).then((stat) => {
      const icon = stat.trim() === "Charging" ? "CHR" : "PWR";
      battState.set(`${icon} \u2022 ${cap.trim()}%`);
    }).catch(() => battState.set(`PWR \u2022 ${cap.trim()}%`));
  }).catch(() => battState.set("PWR \u2022 AC"));
}, 1e4);
setInterval(() => {
  execAsync(["sh", "-c", "nmcli -t -f WIFI g"]).then((out) => {
    wifiState.set(out.trim() === "enabled" ? "Wi-Fi \u2022 On" : "Wi-Fi \u2022 Off");
  }).catch(() => {
  });
}, 7e3);
setInterval(() => {
  execAsync(["sh", "-c", "rfkill list bluetooth | grep 'Soft blocked: yes'"]).then((out) => {
    btState.set(out ? "BT \u2022 Off" : "BT \u2022 On");
  }).catch(() => btState.set("BT \u2022 On"));
}, 8e3);
setInterval(() => {
  execAsync(["sh", "-c", "niri msg -j workspaces"]).then((out) => {
    niriWorkspaces.set(out.trim() || "[]");
  }).catch(() => {
  });
}, 500);
try {
  const wp = AstalWp.get_default()?.audio;
  if (wp) {
    if (wp.default_speaker) {
      wp.default_speaker.connect("notify::volume", () => volVal.set(Math.round(wp.default_speaker.volume * 100)));
      wp.default_speaker.connect("notify::mute", () => volVal.set(wp.default_speaker.mute ? 0 : Math.round(wp.default_speaker.volume * 100)));
    }
    if (wp.default_microphone) {
      wp.default_microphone.connect("notify::volume", () => micVal.set(Math.round(wp.default_microphone.volume * 100)));
      wp.default_microphone.connect("notify::mute", () => micVal.set(wp.default_microphone.mute ? 0 : Math.round(wp.default_microphone.volume * 100)));
    }
  }
} catch (e) {
  setInterval(() => {
    execAsync(["sh", "-c", "wpctl get-volume @DEFAULT_AUDIO_SINK@"]).then((out) => {
      if (out.includes("[MUTED]")) volVal.set(0);
      else {
        const m = out.match(/Volume:\s+([0-9.]+)/);
        if (m) volVal.set(Math.round(parseFloat(m[1]) * 100));
      }
    }).catch(() => {
    });
    execAsync(["sh", "-c", "wpctl get-volume @DEFAULT_AUDIO_SOURCE@"]).then((out) => {
      if (out.includes("[MUTED]")) micVal.set(0);
      else {
        const m = out.match(/Volume:\s+([0-9.]+)/);
        if (m) micVal.set(Math.round(parseFloat(m[1]) * 100));
      }
    }).catch(() => {
    });
  }, 2e3);
}
try {
  const mpris = AstalMpris.get_default();
  if (mpris) {
    const updateMedia = () => {
      const players = mpris.get_players();
      if (players.length > 0) {
        const p = players[0];
        mediaTrack.set(p.title || "Nessuna riproduzione");
        mediaArtist.set(p.artist || "Sconosciuto");
        isPlaying.set(p.playback_status === AstalMpris.PlaybackStatus.PLAYING);
      } else {
        mediaTrack.set("Nessuna riproduzione");
        mediaArtist.set("");
        isPlaying.set(false);
      }
    };
    mpris.connect("notify::players", updateMedia);
    setInterval(updateMedia, 2e3);
  }
} catch (e) {
  setInterval(() => {
    execAsync(["playerctl", "metadata", "title"]).then((t) => mediaTrack.set(t.trim() || "Nessuna riproduzione")).catch(() => mediaTrack.set("Nessuna riproduzione"));
    execAsync(["playerctl", "metadata", "artist"]).then((a) => mediaArtist.set(a.trim())).catch(() => {
    });
    execAsync(["playerctl", "status"]).then((s) => isPlaying.set(s.trim() === "Playing")).catch(() => isPlaying.set(false));
  }, 3e3);
}
function scanWifi() {
  execAsync(["sh", "-c", "nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE dev wifi list | grep -v '^:' | head -n 8"]).then((out) => {
    const lines = out.split("\n").filter(Boolean);
    const list = lines.map((l) => {
      const parts = l.split(":");
      return { ssid: parts[0] || "Wi-Fi Nascosto", signal: parts[1] || "50", sec: parts[2] || "Open", active: parts[3] === "*" || parts[3] === "yes" };
    });
    wifiList.set(list);
  }).catch(() => {
  });
}
function scanBt() {
  execAsync(["sh", "-c", "bluetoothctl devices | head -n 8"]).then((out) => {
    const lines = out.split("\n").filter(Boolean);
    const list = lines.map((l) => {
      const parts = l.split(" ");
      const mac = parts[1] || "";
      const name = parts.slice(2).join(" ") || "Dispositivo Bluetooth";
      const connected = execSync(`bluetoothctl info ${mac} | grep -q 'Connected: yes' && echo yes`).includes("yes");
      return { mac, name, connected };
    });
    btList.set(list);
  }).catch(() => {
  });
}
function updateAudioHub() {
  execAsync(["sh", "-c", "LC_ALL=C pactl list sinks short"]).then((out) => {
    const def = execSync("pactl get-default-sink 2>/dev/null");
    const lines = out.split("\n").filter(Boolean);
    const sinks = lines.map((l) => {
      const parts = l.split("	");
      const id = parts[0];
      const name = parts[1];
      const desc = name.replace("alsa_output.", "").replace("usb-", "").replace(".analog-stereo", "").replace(".pro-output-0", "").replace("_", " ");
      return { id, name, desc: desc || name, active: name === def };
    });
    audioSinks.set(sinks);
  }).catch(() => {
  });
  execAsync(["sh", "-c", "LC_ALL=C pactl list sources short | grep -v 'monitor'"]).then((out) => {
    const def = execSync("pactl get-default-source 2>/dev/null");
    const lines = out.split("\n").filter(Boolean);
    const sources = lines.map((l) => {
      const parts = l.split("	");
      const id = parts[0];
      const name = parts[1];
      const desc = name.replace("alsa_input.", "").replace("usb-", "").replace(".analog-stereo", "").replace(".pro-input-0", "").replace("_", " ");
      return { id, name, desc: desc || name, active: name === def };
    });
    audioSources.set(sources);
  }).catch(() => {
  });
  execAsync(["sh", "-c", "LC_ALL=C pactl list sink-inputs"]).then((out) => {
    const blocks = out.split("Sink Input #").filter(Boolean);
    const streams = [];
    blocks.forEach((b) => {
      const lines = b.split("\n");
      const id = lines[0]?.trim() || "";
      let name = `Applicazione #${id}`;
      let vol = 80;
      let mute = false;
      lines.forEach((l) => {
        if (l.includes("application.name = ") || l.includes("media.name = ") || l.includes("node.name = ")) {
          name = l.split("=")[1]?.replace(/"/g, "").trim() || name;
        }
        if (l.includes("Volume:")) {
          const match = l.match(/(\d+)%/);
          if (match && match[1]) vol = parseInt(match[1]);
        }
        if (l.includes("Mute: yes")) mute = true;
      });
      if (id) streams.push({ id, name, vol, mute });
    });
    appStreams.set(streams);
  }).catch(() => {
  });
}
var audioTimer = default2.timeout_add(default2.PRIORITY_DEFAULT, 3e3, () => {
  updateAudioHub();
  return default2.SOURCE_CONTINUE;
});
var appsService = new AstalApps.Apps();
var queryVar = Variable("");
var activeCategory = Variable("Tutti");
var listbox = new Gtk4.ListBox({ css_classes: ["launcher-list"] });
var CATEGORY_MAP = {
  "\u{1F310} Internet": ["Network", "WebBrowser", "Email"],
  "\u{1F3A8} Multimedia": ["Audio", "Video", "AudioVideo", "Graphics"],
  "\u{1F6E0}\uFE0F Sistema": ["System", "Settings", "Emulator"],
  "\u{1F9F0} Utilit\xE0": ["Utility", "TextEditor", "Development"],
  "\u{1F4BC} Ufficio": ["Office"],
  "\u{1F3AE} Giochi": ["Game"]
};
function updateAppList() {
  let child = listbox.get_first_child();
  while (child) {
    const next = child.get_next_sibling();
    listbox.remove(child);
    child = next;
  }
  let apps = appsService.get_list();
  const q = queryVar.get();
  const cat = activeCategory.get();
  if (q) {
    apps = appsService.fuzzy_query(q);
  } else {
    if (cat !== "Tutti") {
      const allowedCats = CATEGORY_MAP[cat] || [];
      apps = apps.filter((app) => {
        if (!app.categories) return false;
        return app.categories.some((c) => allowedCats.includes(c));
      });
    }
    apps.sort((a, b) => a.name.localeCompare(b.name));
  }
  apps = apps.slice(0, 40);
  if (apps.length === 0) {
    listbox.append(widget_exports.Label({ label: "Nessuna applicazione trovata", css_classes: ["launcher-empty"] }));
  } else {
    apps.forEach((app) => {
      const row = widget_exports.Box({
        css_classes: ["app-card"],
        orientation: Gtk4.Orientation.HORIZONTAL,
        spacing: 14,
        children: [
          widget_exports.Image({ icon_name: app.icon_name || "application-x-executable", pixel_size: 36, css_classes: ["app-icon"] }),
          widget_exports.Box({
            orientation: Gtk4.Orientation.VERTICAL,
            valign: Gtk4.Align.CENTER,
            children: [
              widget_exports.Label({ label: app.name, xalign: 0, css_classes: ["app-name"] }),
              widget_exports.Label({ label: app.description || "Applicazione Ermete OS", xalign: 0, css_classes: ["app-desc"] })
            ]
          })
        ]
      });
      const gesture = new Gtk4.GestureClick();
      gesture.connect("released", () => {
        app.launch();
        toggleExclusiveModal("launcher");
      });
      row.add_controller(gesture);
      listbox.append(row);
    });
  }
}
function SysTray() {
  const tray = AstalTray.get_default();
  return widget_exports.Box({
    css_classes: ["bar-pill", "systray-box"],
    spacing: 8,
    visible: bind(tray, "items").as((items) => items.length > 0),
    children: bind(tray, "items").as(
      (items) => items.map((item) => widget_exports.Button({
        css_classes: ["tray-item-btn"],
        tooltip_markup: bind(item, "tooltip_markup"),
        child: widget_exports.Image({
          gicon: bind(item, "gicon"),
          pixel_size: 16
        }),
        onClicked: () => item.activate(0, 0)
      }))
    )
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/modals.ts
import AstalWp2 from "gi://AstalWp";

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/firewall.ts
var firewallState = Variable("unknown").poll(5e3, "systemctl is-active firewalld", (out, prev) => {
  return out.trim() === "active" ? "running" : "stopped";
});
var FirewallToggle = () => widget_exports.Button({
  css_classes: firewallState(
    (s) => s === "running" ? ["quick-toggle-btn", "firewall", "active"] : ["quick-toggle-btn", "firewall"]
  ),
  hexpand: true,
  label: firewallState(
    (s) => s === "running" ? "\u{1F6E1}\uFE0F Firewall \u2022 On" : "\u{1F6E1}\uFE0F Firewall \u2022 Off"
  ),
  onClicked: () => {
    const action = firewallState.get() === "running" ? "stop" : "start";
    execAsync(["pkexec", "systemctl", action, "firewalld"]).then(() => {
      setTimeout(() => {
        execAsync(["firewall-cmd", "--state"]).then((out) => firewallState.set(out.trim() === "running" ? "running" : "stopped")).catch(() => firewallState.set("stopped"));
      }, 1e3);
    }).catch((err) => console.error("Firewall toggle error: ", err));
  }
});

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/updater.ts
var updateState = Variable({ pendingReboot: false, statusText: "Controllo..." }).poll(6e4, "rpm-ostree status", (out) => {
  const lines = out.split("\n").filter((l) => l.trim().startsWith("ostree-") || l.trim().startsWith("\u25CF ostree-"));
  const pendingReboot = lines.length > 0 && !lines[0].includes("\u25CF");
  return {
    pendingReboot,
    statusText: pendingReboot ? "Riavvio Necessario" : "Sistema Aggiornato"
  };
});
var UpdaterButton = () => widget_exports.Button({
  css_classes: updateState(
    (s) => s.pendingReboot ? ["quick-toggle-btn", "updater", "active", "warning"] : ["quick-toggle-btn", "updater"]
  ),
  hexpand: true,
  label: updateState((s) => `\u{1F680} OS: ${s.statusText}`),
  onClicked: () => {
    execAsync(["foot", "sh", "-c", "echo 'Avvio ricerca aggiornamenti nella Forgia...'; rpm-ostree upgrade; echo ''; read -p 'Premi Invio per uscire...'"]).catch((err) => console.error(err));
  }
});

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/modals.ts
function NiriWorkspaces(connector) {
  const btns = [];
  let wsRefs = [];
  for (let i = 0; i < 10; i++) {
    btns.push(widget_exports.Button({
      css_classes: ["workspace-btn"],
      visible: false,
      onClicked: () => {
        if (wsRefs[i] !== void 0) {
          const ref = wsRefs[i];
          default2.spawn_command_line_async(`niri msg action focus-workspace ${ref}`);
        }
      }
    }));
  }
  niriWorkspaces.subscribe((json) => {
    try {
      let wss = JSON.parse(json);
      if (connector) {
        wss = wss.filter((w) => w.output === connector);
      }
      wss.sort((a, b) => a.idx - b.idx);
      for (let i = 0; i < 10; i++) {
        const btn = btns[i];
        if (i < wss.length) {
          const ws = wss[i];
          wsRefs[i] = ws.name ? ws.name : ws.idx;
          btn.label = ws.name ? ws.name : `${ws.idx}`;
          if (ws.is_focused) btn.css_classes = ["workspace-btn", "focused"];
          else if (ws.is_active) btn.css_classes = ["workspace-btn", "active"];
          else btn.css_classes = ["workspace-btn"];
          btn.visible = true;
        } else {
          wsRefs[i] = void 0;
          btn.visible = false;
        }
      }
    } catch {
    }
  });
  return widget_exports.Box({
    css_classes: ["bar-pill", "workspace-container"],
    spacing: 2,
    setup: (self) => {
      const scroll = new Gtk4.EventControllerScroll({
        flags: Gtk4.EventControllerScrollFlags.VERTICAL | Gtk4.EventControllerScrollFlags.DISCRETE
      });
      scroll.connect("scroll", (ctrl, dx, dy) => {
        if (dy > 0) {
          default2.spawn_command_line_async("niri msg action focus-workspace-down");
        } else if (dy < 0) {
          default2.spawn_command_line_async("niri msg action focus-workspace-up");
        }
        return true;
      });
      self.add_controller(scroll);
    },
    children: btns
  });
}
function TopBar(monitor, idx) {
  const { TOP, LEFT, RIGHT } = Astal6.WindowAnchor;
  const leftIsland = widget_exports.Box({
    css_classes: ["bar-pill"],
    spacing: 8,
    valign: Gtk4.Align.CENTER,
    children: [
      widget_exports.Button({
        css_classes: ["os-logo-btn"],
        label: "\u25C8 Ermete",
        onClicked: () => toggleExclusiveModal("launcher")
      }),
      widget_exports.Button({
        css_classes: ["caffeine-indicator"],
        label: caffeineState().as((c) => c ? "\u2668 Awake" : ""),
        visible: caffeineState().as((c) => c),
        onClicked: () => caffeineState.set(false)
      })
    ]
  });
  const centerLeftIsland = widget_exports.Button({
    css_classes: ["bar-pill", "sysmon-pill-btn"],
    valign: Gtk4.Align.CENTER,
    onClicked: () => toggleExclusiveModal("sys-monitor"),
    child: widget_exports.Box({
      spacing: 6,
      children: [
        widget_exports.Label({ label: cpuUsage().as((c) => `CPU ${c}`) }),
        widget_exports.Label({ label: "\u2022", css_classes: ["workspace-indicator"] }),
        widget_exports.Label({ label: ramUsage().as((r) => `RAM ${r}`) })
      ]
    })
  });
  const centerIsland = widget_exports.Button({
    css_classes: ["bar-pill", "media-pill-btn"],
    valign: Gtk4.Align.CENTER,
    onClicked: () => toggleExclusiveModal("media-player"),
    child: widget_exports.Box({
      spacing: 6,
      children: [
        widget_exports.Label({ label: isPlaying().as((p) => p ? "\u25B6" : "\u266B") }),
        widget_exports.Label({ label: mediaTrack().as((t) => t.length > 28 ? t.substring(0, 26) + "\u2026" : t) })
      ]
    })
  });
  const centerRightIsland = widget_exports.Button({
    css_classes: ["bar-pill", "clock-btn"],
    valign: Gtk4.Align.CENTER,
    onClicked: () => toggleExclusiveModal("calendar"),
    child: widget_exports.Box({
      spacing: 6,
      children: [
        widget_exports.Label({ label: timeState() }),
        widget_exports.Label({ label: "\u2022", css_classes: ["workspace-indicator"] }),
        widget_exports.Label({ label: dateState() })
      ]
    })
  });
  const rightIsland = widget_exports.Box({
    css_classes: ["bar-pill"],
    spacing: 6,
    valign: Gtk4.Align.CENTER,
    children: [
      SysTray(),
      widget_exports.Button({
        css_classes: ["status-pill-btn"],
        onClicked: () => {
          scanWifi();
          toggleExclusiveModal("wifi-modal");
        },
        child: widget_exports.Box({
          spacing: 6,
          children: [
            widget_exports.Label({ label: "\uF1EB", css_classes: ["status-icon", "wifi"] }),
            widget_exports.Label({ label: wifiState().as((w) => w.includes("On") ? "Wi-Fi" : "Off") })
          ]
        })
      }),
      widget_exports.Label({ label: "\u2022", css_classes: ["workspace-indicator"] }),
      widget_exports.Button({
        css_classes: ["status-pill-btn"],
        onClicked: () => {
          scanBt();
          toggleExclusiveModal("bt-modal");
        },
        child: widget_exports.Box({
          spacing: 6,
          children: [
            widget_exports.Label({ label: "\uF294", css_classes: ["status-icon", "bt"] }),
            widget_exports.Label({ label: btState().as((b) => b.includes("On") ? "BT" : "Off") })
          ]
        })
      }),
      widget_exports.Label({ label: "\u2022", css_classes: ["workspace-indicator"] }),
      widget_exports.Button({
        css_classes: ["status-pill-btn"],
        onClicked: () => {
          updateAudioHub();
          toggleExclusiveModal("audio-modal");
        },
        child: widget_exports.Box({
          spacing: 6,
          children: [
            widget_exports.Label({ label: "\u266B", css_classes: ["status-icon", "vol"] }),
            widget_exports.Label({ label: volVal().as((v) => v === 0 ? "Muto" : `${v}%`) })
          ]
        })
      }),
      widget_exports.Label({ label: "\u2022", css_classes: ["workspace-indicator"] }),
      widget_exports.Button({
        css_classes: ["status-pill-btn"],
        onClicked: () => toggleExclusiveModal("quick-settings"),
        child: widget_exports.Box({
          spacing: 6,
          children: [
            widget_exports.Label({ label: "\uF240", css_classes: ["status-icon", "batt"], visible: battState().as((b) => !b.includes("AC")) }),
            widget_exports.Label({ label: battState().as((b) => b.replace("PWR \u2022 ", "")), visible: battState().as((b) => !b.includes("AC")) }),
            widget_exports.Label({ label: "\u2756 Config", css_classes: ["status-icon", "gear"] })
          ]
        })
      }),
      widget_exports.Button({
        css_classes: ["power-btn"],
        label: "\u23FB",
        onClicked: () => toggleExclusiveModal("powermenu")
      })
    ]
  });
  return widget_exports.Window({
    name: `bar-${idx}`,
    namespace: "bar",
    application: app_default,
    gdkmonitor: monitor,
    anchor: TOP | LEFT | RIGHT,
    exclusivity: Astal6.Exclusivity.EXCLUSIVE,
    heightRequest: 28,
    visible: true,
    child: widget_exports.CenterBox({
      css_classes: ["top-bar"],
      setup: (self) => {
        const scroll = new Gtk4.EventControllerScroll({
          flags: Gtk4.EventControllerScrollFlags.VERTICAL | Gtk4.EventControllerScrollFlags.DISCRETE
        });
        scroll.connect("scroll", (ctrl, dx, dy) => {
          if (dy > 0) {
            default2.spawn_command_line_async("niri msg action focus-column-right");
          } else if (dy < 0) {
            default2.spawn_command_line_async("niri msg action focus-column-left");
          }
          return true;
        });
        self.add_controller(scroll);
      },
      startWidget: widget_exports.Box({ spacing: 8, children: [leftIsland, NiriWorkspaces(monitor.get_connector() || "")] }),
      centerWidget: widget_exports.Box({ spacing: 8, children: [centerIsland, centerRightIsland] }),
      endWidget: widget_exports.Box({ halign: Gtk4.Align.END, spacing: 8, children: [centerLeftIsland, rightIsland] })
    })
  });
}
function WifiModal() {
  const { TOP, RIGHT } = Astal6.WindowAnchor;
  return PopupWindow({
    name: "wifi-modal",
    namespace: "wifi-modal",
    application: app_default,
    anchor: TOP | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginRight: 150,
    child: widget_exports.Box({
      css_classes: ["focused-modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 14,
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: "\uF1EB  Connessione Wi-Fi", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
            widget_exports.Button({ label: "\u2715", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("wifi-modal") })
          ]
        }),
        widget_exports.Button({
          css_classes: wifiState().as((w) => w.includes("On") ? ["quick-toggle-btn", "wifi", "active"] : ["quick-toggle-btn", "wifi"]),
          label: wifiState().as((w) => w.includes("On") ? "\u2714 Wi-Fi Attivo \u2022 Clicca per Disattivare" : "\u2715 Wi-Fi Disattivato \u2022 Clicca per Attivare"),
          onClicked: () => {
            execAsync(["sh", "-c", "nmcli radio wifi | grep -q 'enabled' && nmcli radio wifi off || nmcli radio wifi on"]).catch(() => {
            });
            wifiState.set(wifiState.get().includes("On") ? "Wi-Fi \u2022 Off" : "Wi-Fi \u2022 On");
          }
        }),
        widget_exports.Box({
          css_classes: ["sub-list-box"],
          orientation: Gtk4.Orientation.VERTICAL,
          spacing: 6,
          children: wifiList().as((list) => {
            if (list.length === 0) return [widget_exports.Label({ label: "Scansione reti Wi-Fi in corso...", css_classes: ["sub-list-label"] })];
            return list.map((net) => widget_exports.Box({
              css_classes: ["sub-list-row"],
              orientation: Gtk4.Orientation.HORIZONTAL,
              spacing: 12,
              children: [
                widget_exports.Label({ label: "\uF1EB", style: "color: #89dceb;" }),
                widget_exports.Label({ label: `${net.ssid} (${net.signal}%)`, css_classes: ["sub-list-label"], hexpand: true, xalign: 0 }),
                widget_exports.Button({
                  css_classes: net.active ? ["connect-btn", "active"] : ["connect-btn"],
                  label: net.active ? "\u2714 Connesso" : "Connetti",
                  onClicked: () => {
                    if (!net.active) execAsync(["nmcli", "dev", "wifi", "connect", net.ssid]).then(() => scanWifi()).catch(() => {
                    });
                  }
                })
              ]
            }));
          })
        }),
        widget_exports.Button({
          css_classes: ["action-pill-btn"],
          label: "\u2699  Impostazioni di Rete Avanzate",
          onClicked: () => {
            toggleExclusiveModal("wifi-modal");
            execAsync(["nm-connection-editor"]).catch(() => {
            });
          }
        })
      ]
    })
  });
}
function BtModal() {
  const { TOP, RIGHT } = Astal6.WindowAnchor;
  return PopupWindow({
    name: "bt-modal",
    namespace: "bt-modal",
    application: app_default,
    anchor: TOP | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginRight: 100,
    child: widget_exports.Box({
      css_classes: ["focused-modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 14,
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: "\uF294  Dispositivi Bluetooth", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
            widget_exports.Button({ label: "\u2715", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("bt-modal") })
          ]
        }),
        widget_exports.Button({
          css_classes: btState().as((b) => b.includes("On") ? ["quick-toggle-btn", "bt", "active"] : ["quick-toggle-btn", "bt"]),
          label: btState().as((b) => b.includes("On") ? "\u2714 Bluetooth Attivo \u2022 Clicca per Disattivare" : "\u2715 Bluetooth Disattivato \u2022 Clicca per Attivare"),
          onClicked: () => {
            execAsync(["sh", "-c", "rfkill list bluetooth | grep -q 'Soft blocked: yes' && rfkill unblock bluetooth || rfkill block bluetooth"]).catch(() => {
            });
            btState.set(btState.get().includes("On") ? "BT \u2022 Off" : "BT \u2022 On");
          }
        }),
        widget_exports.Box({
          css_classes: ["sub-list-box"],
          orientation: Gtk4.Orientation.VERTICAL,
          spacing: 6,
          children: btList().as((list) => {
            if (list.length === 0) return [widget_exports.Label({ label: "Scansione dispositivi BT in corso...", css_classes: ["sub-list-label"] })];
            return list.map((dev) => widget_exports.Box({
              css_classes: ["sub-list-row"],
              orientation: Gtk4.Orientation.HORIZONTAL,
              spacing: 12,
              children: [
                widget_exports.Label({ label: "\uF294", style: "color: #89b4fa;" }),
                widget_exports.Label({ label: dev.name, css_classes: ["sub-list-label"], hexpand: true, xalign: 0 }),
                widget_exports.Button({
                  css_classes: dev.connected ? ["connect-btn", "active"] : ["connect-btn"],
                  label: dev.connected ? "\u2714 Connesso" : "Connetti",
                  onClicked: () => {
                    execAsync(["bluetoothctl", dev.connected ? "disconnect" : "connect", dev.mac]).then(() => scanBt()).catch(() => {
                    });
                  }
                })
              ]
            }));
          })
        })
      ]
    })
  });
}
function AudioModal() {
  const { TOP, RIGHT } = Astal6.WindowAnchor;
  const mkSlider = (icon, title, valVar, action) => {
    const scale = new Gtk4.Scale({
      orientation: Gtk4.Orientation.HORIZONTAL,
      adjustment: new Gtk4.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: valVar.get() }),
      css_classes: ["matshell-slider"]
    });
    let timer = null;
    scale.connect("value-changed", () => {
      const val = Math.round(scale.get_value());
      valVar.set(val);
      if (timer !== null) default2.source_remove(timer);
      timer = default2.timeout_add(default2.PRIORITY_DEFAULT, 50, () => {
        action(val);
        timer = null;
        return default2.SOURCE_REMOVE;
      });
    });
    valVar.subscribe((v) => {
      if (Math.round(scale.get_value()) !== v) scale.set_value(v);
    });
    return widget_exports.Box({
      css_classes: ["dongle-slider-section"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 6,
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: `${icon}  ${title}`, css_classes: ["slider-label"], hexpand: true, xalign: 0 }),
            widget_exports.Label({ label: valVar().as((v) => `${v}%`), css_classes: ["slider-val"] })
          ]
        }),
        scale
      ]
    });
  };
  return PopupWindow({
    name: "audio-modal",
    namespace: "audio-modal",
    application: app_default,
    anchor: TOP | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginRight: 60,
    child: widget_exports.Box({
      css_classes: ["focused-modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 16,
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: "\u266B  Centro Audio & Mixer Applicazioni", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
            widget_exports.Button({ label: "\u2715", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("audio-modal") })
          ]
        }),
        // Output Sink Selector
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 10,
          children: [
            widget_exports.Label({ label: "Uscita:", css_classes: ["sub-list-label"], style: "min-width: 70px;" }),
            widget_exports.Button({
              css_classes: ["audio-device-selector"],
              hexpand: true,
              label: audioSinks().as((sinks) => {
                const act = sinks.find((s) => s.active) || sinks[0];
                return act ? `\u2714 ${act.desc}` : "Seleziona Dispositivo Uscita";
              }),
              onClicked: () => {
                const sinks = audioSinks.get();
                if (sinks.length > 1) {
                  const idx = sinks.findIndex((s) => s.active);
                  const next = sinks[(idx + 1) % sinks.length];
                  if (next) {
                    execAsync(["pactl", "set-default-sink", next.name]).then(() => {
                      execAsync(["sh", "-c", `for id in $(pactl list sink-inputs short | awk '{print $1}'); do pactl move-sink-input $id ${next.name}; done`]).catch(() => {
                      });
                      updateAudioHub();
                    }).catch(() => {
                    });
                  }
                }
              }
            })
          ]
        }),
        // Input Source Selector
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 10,
          children: [
            widget_exports.Label({ label: "Microfono:", css_classes: ["sub-list-label"], style: "min-width: 70px;" }),
            widget_exports.Button({
              css_classes: ["audio-device-selector"],
              hexpand: true,
              label: audioSources().as((sources) => {
                const act = sources.find((s) => s.active) || sources[0];
                return act ? `\u2714 ${act.desc}` : "Seleziona Ingresso Mic";
              }),
              onClicked: () => {
                const sources = audioSources.get();
                if (sources.length > 1) {
                  const idx = sources.findIndex((s) => s.active);
                  const next = sources[(idx + 1) % sources.length];
                  if (next) {
                    execAsync(["pactl", "set-default-source", next.name]).then(() => updateAudioHub()).catch(() => {
                    });
                  }
                }
              }
            })
          ]
        }),
        mkSlider("\u266B", "Volume Master Output", volVal, (v) => {
          try {
            const wp = AstalWp2.get_default()?.audio;
            if (wp?.default_speaker) {
              wp.default_speaker.mute = false;
              wp.default_speaker.volume = v / 100;
            }
          } catch (e) {
            execAsync(["sh", "-c", `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SINK@ ${v}%`]).catch(() => {
            });
          }
        }),
        mkSlider("\uF130", "Guadagno Microfono", micVal, (v) => {
          try {
            const wp = AstalWp2.get_default()?.audio;
            if (wp?.default_microphone) {
              wp.default_microphone.mute = false;
              wp.default_microphone.volume = v / 100;
            }
          } catch (e) {
            execAsync(["sh", "-c", `wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${v}%`]).catch(() => {
            });
          }
        }),
        // Application Volume Mixer
        widget_exports.Box({
          css_classes: ["app-mixer-section"],
          orientation: Gtk4.Orientation.VERTICAL,
          spacing: 8,
          children: [
            widget_exports.Label({ label: "Livellamento Flussi Applicativi Attivi:", css_classes: ["sub-list-label"], xalign: 0, style: "color: #89b4fa; font-size: 0.85em;" }),
            widget_exports.Box({
              orientation: Gtk4.Orientation.VERTICAL,
              spacing: 6,
              children: appStreams().as((streams) => {
                if (streams.length === 0) {
                  return [widget_exports.Label({ label: "Nessun flusso applicativo attivo in riproduzione", css_classes: ["sub-list-label"], style: "color: #a6adc8; font-style: italic; padding: 6px 0;" })];
                }
                return streams.map((st) => {
                  const stVol = Variable(st.vol);
                  const scale = new Gtk4.Scale({
                    orientation: Gtk4.Orientation.HORIZONTAL,
                    adjustment: new Gtk4.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: st.vol }),
                    css_classes: ["matshell-slider"],
                    hexpand: true
                  });
                  scale.connect("value-changed", () => {
                    const val = Math.round(scale.get_value());
                    stVol.set(val);
                    execAsync(["sh", "-c", `pactl set-sink-input-mute ${st.id} 0 2>/dev/null; pactl set-sink-input-volume ${st.id} ${val}%`]).catch(() => {
                    });
                  });
                  return widget_exports.Box({
                    css_classes: ["app-mixer-row"],
                    orientation: Gtk4.Orientation.VERTICAL,
                    spacing: 4,
                    children: [
                      widget_exports.Box({
                        orientation: Gtk4.Orientation.HORIZONTAL,
                        children: [
                          widget_exports.Label({ label: st.name, css_classes: ["app-mixer-title"], hexpand: true, xalign: 0 }),
                          widget_exports.Label({ label: stVol().as((v) => `${v}%`), style: "color: #89b4fa; font-size: 0.85em; font-weight: 800; margin-right: 10px;" }),
                          widget_exports.Button({
                            css_classes: st.mute ? ["app-mixer-mute-btn", "muted"] : ["app-mixer-mute-btn"],
                            label: st.mute ? "Muto" : "Attivo",
                            onClicked: () => {
                              execAsync(["pactl", "set-sink-input-mute", st.id, "toggle"]).then(() => updateAudioHub()).catch(() => {
                              });
                            }
                          })
                        ]
                      }),
                      scale
                    ]
                  });
                });
              })
            })
          ]
        })
      ]
    })
  });
}
function QuickSettingsModal() {
  const { TOP, RIGHT } = Astal6.WindowAnchor;
  const profileCard = widget_exports.Box({
    css_classes: ["profile-card"],
    orientation: Gtk4.Orientation.HORIZONTAL,
    spacing: 16,
    children: [
      widget_exports.Label({ label: "\u25C8", css_classes: ["profile-avatar"] }),
      widget_exports.Box({
        orientation: Gtk4.Orientation.VERTICAL,
        valign: Gtk4.Align.CENTER,
        hexpand: true,
        children: [
          widget_exports.Label({ label: "Ermete OS", css_classes: ["profile-name"], xalign: 0 }),
          widget_exports.Label({ label: "Trismegistus \u2022 Linux Bedrock", css_classes: ["profile-sub"], xalign: 0 })
        ]
      }),
      widget_exports.Label({ label: uptimeState(), css_classes: ["uptime-badge"] })
    ]
  });
  const mkSlider = (icon, title, valVar, action) => {
    const scale = new Gtk4.Scale({
      orientation: Gtk4.Orientation.HORIZONTAL,
      adjustment: new Gtk4.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: valVar.get() }),
      css_classes: ["matshell-slider"]
    });
    let timer = null;
    scale.connect("value-changed", () => {
      const val = Math.round(scale.get_value());
      valVar.set(val);
      if (timer !== null) default2.source_remove(timer);
      timer = default2.timeout_add(default2.PRIORITY_DEFAULT, 50, () => {
        action(val);
        timer = null;
        return default2.SOURCE_REMOVE;
      });
    });
    valVar.subscribe((v) => {
      if (Math.round(scale.get_value()) !== v) scale.set_value(v);
    });
    return widget_exports.Box({
      css_classes: ["dongle-slider-section"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 6,
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: `${icon}  ${title}`, css_classes: ["slider-label"], hexpand: true, xalign: 0 }),
            widget_exports.Label({ label: valVar().as((v) => `${v}%`), css_classes: ["slider-val"] })
          ]
        }),
        scale
      ]
    });
  };
  return PopupWindow({
    name: "quick-settings",
    namespace: "quick-settings",
    application: app_default,
    anchor: TOP | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginRight: 16,
    child: widget_exports.Box({
      css_classes: ["focused-modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 16,
      children: [
        profileCard,
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          children: [
            widget_exports.Label({ label: "\u2756  Impostazioni & Telemetria", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
            widget_exports.Button({ label: "\u2715", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("quick-settings") })
          ]
        }),
        widget_exports.Box({
          spacing: 12,
          children: [
            widget_exports.Button({
              css_classes: caffeineState().as((c) => c ? ["quick-toggle-btn", "caffeine", "active"] : ["quick-toggle-btn", "caffeine"]),
              hexpand: true,
              label: caffeineState().as((c) => c ? "\u2668 Awake \u2022 On" : "\u2668 Awake \u2022 Normal"),
              onClicked: () => caffeineState.set(!caffeineState.get())
            }),
            widget_exports.Button({
              css_classes: ["quick-toggle-btn", "shot"],
              hexpand: true,
              label: "\uF030  Cattura",
              onClicked: () => {
                toggleExclusiveModal("quick-settings");
                execAsync(["sh", "-c", 'sleep 0.5 && grim -g "$(slurp)" ~/Pictures/screenshot_$(date +%s).png']).catch(() => {
                });
              }
            }),
            FirewallToggle()
          ]
        }),
        widget_exports.Box({
          spacing: 12,
          children: [
            UpdaterButton(),
            widget_exports.Button({
              css_classes: ["quick-toggle-btn", "clipboard"],
              hexpand: true,
              label: "\u{1F4CB} Appunti",
              onClicked: () => toggleExclusiveModal("clipboard")
            })
          ]
        }),
        mkSlider("\u2600", "Luminosit\xE0 Monitor (DDC/CI & eDP)", brightVal, (v) => {
          execAsync(["sh", "-c", `ddcutil setvcp 10 ${v} 2>/dev/null || brightnessctl s ${v}% 2>/dev/null || true`]).catch(() => {
          });
        }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 12,
          children: [
            widget_exports.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "\uF2DB  btop", onClicked: () => {
              toggleExclusiveModal("quick-settings");
              execAsync(["foot", "btop"]).catch(() => {
              });
            } }),
            widget_exports.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "\u{1F4C1}  Files", onClicked: () => {
              toggleExclusiveModal("quick-settings");
              execAsync(["thunar", default2.get_home_dir()]).catch(() => {
              });
            } }),
            widget_exports.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "\u2699  Impostazioni", onClicked: () => {
              toggleExclusiveModal("quick-settings");
              toggleExclusiveModal("settings-modal");
            } })
          ]
        })
      ]
    })
  });
}
function ErmeteSettingsModal() {
  const mkSettingRow = (icon, title, desc, actionWidget) => widget_exports.Box({
    css_classes: ["win-setting-row"],
    orientation: Gtk4.Orientation.HORIZONTAL,
    spacing: 16,
    children: [
      widget_exports.Label({ label: icon, css_classes: ["win-row-icon"] }),
      widget_exports.Box({
        orientation: Gtk4.Orientation.VERTICAL,
        valign: Gtk4.Align.CENTER,
        hexpand: true,
        children: [
          widget_exports.Label({ label: title, css_classes: ["win-row-title"], xalign: 0 }),
          widget_exports.Label({ label: desc, css_classes: ["win-row-desc"], xalign: 0, wrap: true, visible: desc !== "" })
        ]
      }),
      widget_exports.Box({
        valign: Gtk4.Align.CENTER,
        children: [actionWidget]
      })
    ]
  });
  const mkSettingGroup = (title, rows) => {
    const children = [];
    for (let i = 0; i < rows.length; i++) {
      children.push(rows[i]);
      if (i < rows.length - 1) {
        children.push(widget_exports.Box({ css_classes: ["win-row-divider"] }));
      }
    }
    return widget_exports.Box({
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 8,
      children: [
        widget_exports.Label({ label: title, css_classes: ["win-group-title"], xalign: 0, visible: title !== "" }),
        widget_exports.Box({
          css_classes: ["win-setting-group-card"],
          orientation: Gtk4.Orientation.VERTICAL,
          children
        })
      ]
    });
  };
  const mkButton = (icon, label, action) => widget_exports.Button({
    css_classes: ["win-action-btn"],
    child: widget_exports.Box({
      spacing: 6,
      children: [
        widget_exports.Label({ label: icon }),
        widget_exports.Label({ label })
      ]
    }),
    onClicked: () => action()
  });
  const mkToggle = (active, action) => {
    const sw = new Gtk4.Switch({ active, valign: Gtk4.Align.CENTER });
    sw.connect("notify::active", () => action(sw.active));
    return sw;
  };
  const mkDropdown = (options, selectedIdx, action) => {
    const dd = new Gtk4.DropDown({
      model: Gtk4.StringList.new(options),
      selected: selectedIdx,
      valign: Gtk4.Align.CENTER
    });
    dd.connect("notify::selected", () => action(dd.selected, options[dd.selected]));
    return dd;
  };
  const pageSistema = widget_exports.Box({
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 24,
    children: [
      widget_exports.Label({ label: "Sistema", css_classes: ["win-page-title"], xalign: 0 }),
      mkSettingGroup("Display & Finestre", [
        mkSettingRow(
          "\u{1F5A5}\uFE0F",
          "Scala Display (DPI)",
          "Regola la dimensione globale dell'interfaccia (richiede riavvio per alcune app).",
          mkDropdown(["1.0x (100%)", "1.25x (125%)", "1.5x (150%)", "2.0x (200%)"], 0, (idx, val) => {
            const scale = val.split("x")[0];
            execAsync(["sh", "-c", `sed -i 's/scale .*/scale ${scale}/' ~/.config/niri/config.kdl`]).catch(() => {
            });
          })
        ),
        mkSettingRow(
          "\u{1F532}",
          "Spaziatura Finestre",
          "Distanza in pixel tra le finestre affiancate (Gaps).",
          mkDropdown(["Nessuna (0px)", "Stretta (8px)", "Media (16px)", "Larga (24px)"], 1, (idx, val) => {
            const gap = val.includes("0") ? "0" : val.includes("8") ? "8" : val.includes("16") ? "16" : "24";
            execAsync(["sh", "-c", `sed -i 's/gaps .*/gaps ${gap}/' ~/.config/niri/config.kdl`]).catch(() => {
            });
          })
        ),
        mkSettingRow(
          "\u{1F5B2}\uFE0F",
          "Gestione Multi-Monitor",
          "Duplica o estendi automaticamente gli schermi connessi.",
          mkButton("\u{1F5A5}\uFE0F", "Configura Display", () => execAsync(["sh", "-c", `killall wl-mirror 2>/dev/null; M2=$(niri msg -j outputs | jq -r 'keys | .[1]'); if [ -n "$M2" ] && [ "$M2" != "null" ]; then niri msg output "$M2" on; niri msg output "$M2" position auto; fi`]).catch(() => {
          }))
        )
      ]),
      mkSettingGroup("Prestazioni & Alimentazione", [
        mkSettingRow(
          "\u26A1",
          "Modalit\xE0 Caffeine",
          "Impedisce la sospensione automatica dello schermo.",
          mkToggle(caffeineState.get(), (state) => caffeineState.set(state))
        ),
        mkSettingRow(
          "\u{1F50B}",
          "Stato Batteria",
          "Dettagli hardware e consumo.",
          widget_exports.Label({ label: battState().as((b) => b), css_classes: ["win-status-label"] })
        )
      ])
    ]
  });
  const pagePersonalizzazione = widget_exports.Box({
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 24,
    children: [
      widget_exports.Label({ label: "Personalizzazione", css_classes: ["win-page-title"], xalign: 0 }),
      mkSettingGroup("Estetica del Desktop", [
        mkSettingRow(
          "\u{1F308}",
          "Tema Dinamico (Matugen)",
          "Rigenera i colori di sistema basandoti sullo sfondo attuale.",
          mkButton("\u{1F3A8}", "Estrai Colori", () => execAsync(["sh", "-c", "matugen image ~/.config/ermete/wallpaper.png || true"]).catch(() => {
          }))
        ),
        mkSettingRow(
          "\u{1F5BC}\uFE0F",
          "Sfondo Scrivania",
          "Sostituisci o ricarica lo sfondo corrente (Swaybg).",
          mkButton("\u{1F504}", "Ricarica", () => execAsync(["systemctl", "--user", "restart", "ermete-wallpaper.service"]).catch(() => {
          }))
        ),
        mkSettingRow(
          "\u{1F3A8}",
          "Pannello Superiore (AGS)",
          "Applica le modifiche CSS ricaricando l'interfaccia.",
          mkButton("\u{1F504}", "Riavvia AGS", () => execAsync(["systemctl", "--user", "restart", "ermete-ags.service"]).catch(() => {
          }))
        )
      ]),
      mkSettingGroup("Terminale", [
        mkSettingRow(
          "\u2328\uFE0F",
          "Dimensione Font",
          "Grandezza del carattere nel terminale Foot.",
          mkDropdown(["Piccolo (10)", "Medio (11)", "Grande (13)", "Enorme (16)"], 1, (idx, val) => {
            const size = val.includes("10") ? "10" : val.includes("11") ? "11" : val.includes("13") ? "13" : "16";
            execAsync(["sh", "-c", `sed -i 's/font=JetBrains Mono:size=.*/font=JetBrains Mono:size=${size}/' ~/.config/foot/foot.ini`]).catch(() => {
            });
          })
        ),
        mkSettingRow(
          "\u{1F441}\uFE0F",
          "Trasparenza (Opacit\xE0)",
          "Regola il livello di glassmorphism nel terminale.",
          mkDropdown(["Solido (100%)", "Trasparente (90%)", "Vetro (80%)"], 1, (idx, val) => {
            const alpha = val.includes("100") ? "1.0" : val.includes("90") ? "0.9" : "0.8";
            execAsync(["sh", "-c", `sed -i 's/alpha=.*/alpha=${alpha}/' ~/.config/foot/foot.ini`]).catch(() => {
            });
          })
        )
      ])
    ]
  });
  const pageInfo = widget_exports.Box({
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 24,
    children: [
      widget_exports.Label({ label: "Informazioni Sistema", css_classes: ["win-page-title"], xalign: 0 }),
      widget_exports.Box({
        css_classes: ["win-about-card"],
        orientation: Gtk4.Orientation.VERTICAL,
        spacing: 12,
        children: [
          widget_exports.Box({
            orientation: Gtk4.Orientation.HORIZONTAL,
            spacing: 16,
            children: [
              widget_exports.Label({ label: "\u25C8", css_classes: ["win-about-logo"] }),
              widget_exports.Box({
                orientation: Gtk4.Orientation.VERTICAL,
                valign: Gtk4.Align.CENTER,
                children: [
                  widget_exports.Label({ label: "Ermete OS", css_classes: ["win-about-title"], xalign: 0 }),
                  widget_exports.Label({ label: "Trismegistus Edition (Bedrock Linux)", css_classes: ["win-about-sub"], xalign: 0 }),
                  widget_exports.Label({ label: "OSTree Immutabile", css_classes: ["win-about-sub"], xalign: 0 })
                ]
              })
            ]
          })
        ]
      }),
      mkSettingGroup("Azioni di Sistema", [
        mkSettingRow(
          "\u{1F50D}",
          "Stato Immutabilit\xE0 (OSTree)",
          "Verifica l'albero dei commit e gli aggiornamenti in attesa.",
          mkButton("\u{1F680}", "Controlla", () => {
            toggleExclusiveModal("settings-modal");
            execAsync(["foot", "sh", "-c", "rpm-ostree status; echo ''; read -p 'Premere Invio per chiudere...'"]).catch(() => {
            });
          })
        ),
        mkSettingRow(
          "\uF2DB",
          "Monitoraggio Risorse (btop)",
          "Apri il gestore di processi avanzato nel terminale.",
          mkButton("\u{1F680}", "Apri btop", () => {
            toggleExclusiveModal("settings-modal");
            execAsync(["foot", "btop"]).catch(() => {
            });
          })
        )
      ])
    ]
  });
  const stack = new Gtk4.Stack({
    transition_type: Gtk4.StackTransitionType.SLIDE_UP_DOWN,
    hexpand: true,
    vexpand: true
  });
  const wrapPage = (child) => new Gtk4.ScrolledWindow({
    child: widget_exports.Box({ child, padding: 24 }),
    hscrollbar_policy: Gtk4.PolicyType.NEVER,
    css_classes: ["win-stack-scroll"]
  });
  stack.add_named(wrapPage(pageSistema), "sistema");
  stack.add_named(wrapPage(pagePersonalizzazione), "personalizzazione");
  stack.add_named(wrapPage(pageInfo), "info");
  const activePage = Variable("sistema");
  activePage.subscribe((val) => stack.set_visible_child_name(val));
  const mkNavBtn = (icon, label, page) => widget_exports.Button({
    css_classes: activePage().as((p) => p === page ? ["win-nav-btn", "active"] : ["win-nav-btn"]),
    onClicked: () => activePage.set(page),
    child: widget_exports.Box({
      spacing: 12,
      children: [
        widget_exports.Label({ label: icon, css_classes: ["win-nav-icon"] }),
        widget_exports.Label({ label, css_classes: ["win-nav-label"] })
      ]
    })
  });
  const sidebar = widget_exports.Box({
    css_classes: ["win-sidebar"],
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 4,
    children: [
      widget_exports.Box({
        css_classes: ["win-profile-area"],
        spacing: 12,
        children: [
          widget_exports.Label({ label: "\u25C8", css_classes: ["win-avatar"] }),
          widget_exports.Box({
            orientation: Gtk4.Orientation.VERTICAL,
            valign: Gtk4.Align.CENTER,
            children: [
              widget_exports.Label({ label: "Ermete OS", css_classes: ["win-profile-name"], xalign: 0 }),
              widget_exports.Label({ label: "Admin Locale", css_classes: ["win-profile-sub"], xalign: 0 })
            ]
          })
        ]
      }),
      widget_exports.Box({
        css_classes: ["win-search-box"],
        spacing: 8,
        children: [
          widget_exports.Label({ label: "\u{1F50D}", css_classes: ["win-search-icon"] }),
          widget_exports.Label({ label: "Trova impostazione", css_classes: ["win-search-placeholder"] })
        ]
      }),
      widget_exports.Box({ css_classes: ["win-sidebar-divider"] }),
      mkNavBtn("\u{1F5A5}\uFE0F", "Sistema", "sistema"),
      mkNavBtn("\u{1F3A8}", "Personalizzazione", "personalizzazione"),
      mkNavBtn("\u{1F6E1}\uFE0F", "Informazioni", "info")
    ]
  });
  return PopupWindow({
    name: "settings-modal",
    namespace: "settings-modal",
    application: app_default,
    anchor: Astal6.WindowAnchor.NONE,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    child: widget_exports.Box({
      css_classes: ["win-settings-window"],
      orientation: Gtk4.Orientation.HORIZONTAL,
      children: [
        sidebar,
        widget_exports.Box({
          css_classes: ["win-settings-content"],
          hexpand: true,
          vexpand: true,
          children: [stack]
        })
      ]
    })
  });
}
function MediaPlayerDongle() {
  const { TOP } = Astal6.WindowAnchor;
  const content = widget_exports.Box({
    css_classes: ["modal-box", "media-modal-box"],
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 18,
    children: [
      widget_exports.Box({
        orientation: Gtk4.Orientation.HORIZONTAL,
        spacing: 16,
        children: [
          widget_exports.Label({ label: "\u266B", css_classes: ["media-modal-title"], style: "font-size: 2.4em;" }),
          widget_exports.Box({
            orientation: Gtk4.Orientation.VERTICAL,
            valign: Gtk4.Align.CENTER,
            children: [
              widget_exports.Label({ label: mediaTrack(), css_classes: ["media-track-title"], xalign: 0 }),
              widget_exports.Label({ label: mediaArtist(), css_classes: ["media-track-artist"], xalign: 0 })
            ]
          })
        ]
      }),
      widget_exports.Box({
        orientation: Gtk4.Orientation.HORIZONTAL,
        spacing: 14,
        halign: Gtk4.Align.CENTER,
        children: [
          widget_exports.Button({ css_classes: ["media-action-btn"], label: "\u23EE  Prev", onClicked: () => execAsync(["playerctl", "previous"]).catch(() => {
          }) }),
          widget_exports.Button({ css_classes: ["media-action-btn"], label: isPlaying().as((p) => p ? "\u23F8  Pause" : "\u25B6  Play"), onClicked: () => execAsync(["playerctl", "play-pause"]).catch(() => {
          }) }),
          widget_exports.Button({ css_classes: ["media-action-btn"], label: "Next  \u23ED", onClicked: () => execAsync(["playerctl", "next"]).catch(() => {
          }) })
        ]
      })
    ]
  });
  return PopupWindow({
    name: "media-player",
    namespace: "media-player",
    application: app_default,
    anchor: TOP,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    child: content
  });
}
function SysMonitorDongle() {
  const { TOP, RIGHT } = Astal6.WindowAnchor;
  const mkStatCard = (labelClass, icon, title, statVar) => widget_exports.Box({
    css_classes: ["sysmon-card"],
    orientation: Gtk4.Orientation.HORIZONTAL,
    children: [
      widget_exports.Label({ label: `${icon}  ${title}`, css_classes: ["sysmon-label", labelClass], hexpand: true, xalign: 0 }),
      widget_exports.Label({ label: statVar(), css_classes: ["sysmon-val"] })
    ]
  });
  return PopupWindow({
    name: "sys-monitor",
    namespace: "sys-monitor",
    application: app_default,
    anchor: TOP | RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginRight: 260,
    child: widget_exports.Box({
      css_classes: ["modal-box", "sysmon-modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 14,
      children: [
        widget_exports.Label({ label: "Telemetria Hardware Live", css_classes: ["dongle-title"], xalign: 0 }),
        mkStatCard("cpu", "\uF2DB", "Processore CPU", cpuUsage),
        mkStatCard("ram", "\uF538", "Memoria RAM", ramUsage),
        mkStatCard("disk", "\uF0A0", "Archivio Root (/)", diskUsage),
        widget_exports.Box({
          visible: battState().as((b) => !b.includes("AC")),
          child: mkStatCard("batt", "\uF240", "Batteria di Sistema", battState)
        })
      ]
    })
  });
}
function LauncherModal() {
  const { TOP, LEFT } = Astal6.WindowAnchor;
  const searchEntry = new Gtk4.Entry({
    placeholder_text: "Cerca applicazioni...",
    css_classes: ["launcher-entry"]
  });
  searchEntry.connect("changed", () => {
    if (searchEntry.get_text() && activeCategory.get() !== "Tutti") {
      activeCategory.set("Tutti");
    }
    queryVar.set(searchEntry.get_text());
    updateAppList();
  });
  searchEntry.connect("activate", () => {
    let first;
    if (queryVar.get()) {
      first = appsService.fuzzy_query(queryVar.get())[0];
    } else {
      const allowedCats = CATEGORY_MAP[activeCategory.get()] || [];
      first = appsService.get_list().find((app) => activeCategory.get() === "Tutti" || app.categories && app.categories.some((c) => allowedCats.includes(c)));
    }
    if (first) {
      first.launch();
      toggleExclusiveModal("launcher");
    }
  });
  const categorySidebar = widget_exports.Box({
    orientation: Gtk4.Orientation.VERTICAL,
    css_classes: ["launcher-sidebar"],
    spacing: 4,
    children: ["Tutti", ...Object.keys(CATEGORY_MAP)].map(
      (catName) => widget_exports.Button({
        css_classes: ["launcher-cat-btn"],
        label: catName,
        onClicked: () => {
          activeCategory.set(catName);
          searchEntry.set_text("");
          queryVar.set("");
          updateAppList();
        },
        setup: (self) => {
          const updateClass = (val) => {
            const isActive = val === catName;
            const classes = self.css_classes.filter((c) => c !== "active");
            if (isActive) classes.push("active");
            self.css_classes = classes;
          };
          updateClass(activeCategory.get());
          activeCategory.subscribe(updateClass);
        }
      })
    )
  });
  const appsScroll2 = new Gtk4.ScrolledWindow({
    hscrollbar_policy: Gtk4.PolicyType.NEVER,
    vscrollbar_policy: Gtk4.PolicyType.AUTOMATIC,
    css_classes: ["launcher-scroll"],
    child: listbox
  });
  const win = PopupWindow({
    name: "launcher",
    namespace: "launcher",
    application: app_default,
    anchor: TOP | LEFT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    marginLeft: 12,
    child: widget_exports.Box({
      css_classes: ["modal-box", "launcher-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 18,
      children: [
        widget_exports.Box({
          css_classes: ["launcher-header"],
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 14,
          children: [widget_exports.Label({ label: "\uF002", style: "font-size: 1.4em; color: #89b4fa;" }), searchEntry]
        }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          css_classes: ["launcher-layout"],
          spacing: 14,
          children: [categorySidebar, appsScroll2]
        })
      ]
    })
  });
  win.connect("notify::visible", () => {
    if (win.visible) {
      activeCategory.set("Tutti");
      queryVar.set("");
      searchEntry.set_text("");
      searchEntry.grab_focus();
      updateAppList();
    }
  });
  return win;
}
var spotlightQueryVar = Variable("");
var spotlightListbox = new Gtk4.ListBox({ css_classes: ["spotlight-list"] });
var appsScroll = null;
function evaluateMath(query) {
  try {
    if (!/^[0-9+\-*/().\s,]+$/.test(query)) return null;
    const safeQuery = query.replace(/,/g, ".");
    const result = new Function(`return ${safeQuery}`)();
    if (result !== void 0 && !isNaN(result)) {
      return String(result);
    }
  } catch {
  }
  return null;
}
function updateSpotlightList() {
  let child = spotlightListbox.get_first_child();
  while (child) {
    const next = child.get_next_sibling();
    spotlightListbox.remove(child);
    child = next;
  }
  const q = spotlightQueryVar.get().trim();
  if (!q) {
    if (appsScroll) appsScroll.visible = false;
    return;
  }
  if (appsScroll) appsScroll.visible = true;
  let resultsAdded = 0;
  const mathResult = evaluateMath(q);
  if (mathResult) {
    const row = widget_exports.Box({
      css_classes: ["app-card", "spotlight-card"],
      orientation: Gtk4.Orientation.HORIZONTAL,
      spacing: 16,
      children: [
        widget_exports.Label({ label: "\u{1F9EE}", style: "font-size: 2.2em;" }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.VERTICAL,
          valign: Gtk4.Align.CENTER,
          children: [
            widget_exports.Label({ label: mathResult, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
            widget_exports.Label({ label: "Calcolatrice", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
          ]
        })
      ]
    });
    spotlightListbox.append(row);
    resultsAdded++;
  }
  let apps = appsService.fuzzy_query(q).slice(0, 8);
  apps.forEach((app) => {
    const row = widget_exports.Box({
      css_classes: ["app-card", "spotlight-card"],
      orientation: Gtk4.Orientation.HORIZONTAL,
      spacing: 16,
      children: [
        widget_exports.Image({ icon_name: app.icon_name || "application-x-executable", pixel_size: 48, css_classes: ["app-icon"] }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.VERTICAL,
          valign: Gtk4.Align.CENTER,
          children: [
            widget_exports.Label({ label: app.name, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
            widget_exports.Label({ label: app.description || "Applicazione", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
          ]
        })
      ]
    });
    const gesture = new Gtk4.GestureClick();
    gesture.connect("released", () => {
      app.launch();
      toggleExclusiveModal("spotlight");
    });
    row.add_controller(gesture);
    spotlightListbox.append(row);
    resultsAdded++;
  });
  if (resultsAdded === 0 || resultsAdded > 0 && !mathResult) {
    const row = widget_exports.Box({
      css_classes: ["app-card", "spotlight-card"],
      orientation: Gtk4.Orientation.HORIZONTAL,
      spacing: 16,
      children: [
        widget_exports.Label({ label: "\uF120", style: "font-size: 2.2em; color: #a6adc8;" }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.VERTICAL,
          valign: Gtk4.Align.CENTER,
          children: [
            widget_exports.Label({ label: `Esegui: ${q}`, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
            widget_exports.Label({ label: "Comando di sistema (sh -c)", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
          ]
        })
      ]
    });
    const gesture = new Gtk4.GestureClick();
    gesture.connect("released", () => {
      execAsync(["sh", "-c", q]).catch(() => {
      });
      toggleExclusiveModal("spotlight");
    });
    row.add_controller(gesture);
    spotlightListbox.append(row);
  }
}
function SpotlightModal() {
  const { TOP } = Astal6.WindowAnchor;
  const searchEntry = new Gtk4.Entry({
    placeholder_text: "Cerca app, comandi, calcoli...",
    css_classes: ["spotlight-entry"],
    hexpand: true
  });
  searchEntry.connect("changed", () => {
    spotlightQueryVar.set(searchEntry.get_text());
    updateSpotlightList();
  });
  searchEntry.connect("activate", () => {
    const q = spotlightQueryVar.get().trim();
    if (!q) return;
    const mathResult = evaluateMath(q);
    if (!mathResult) {
      const first = appsService.fuzzy_query(q)[0];
      if (first) {
        first.launch();
      } else {
        execAsync(["sh", "-c", q]).catch(() => {
        });
      }
    }
    toggleExclusiveModal("spotlight");
  });
  appsScroll = new Gtk4.ScrolledWindow({
    hscrollbar_policy: Gtk4.PolicyType.NEVER,
    vscrollbar_policy: Gtk4.PolicyType.AUTOMATIC,
    css_classes: ["spotlight-scroll"],
    child: spotlightListbox,
    vexpand: true,
    visible: false
  });
  const win = PopupWindow({
    name: "spotlight",
    namespace: "spotlight",
    application: app_default,
    anchor: TOP,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 180,
    child: widget_exports.Box({
      css_classes: ["modal-box", "spotlight-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 12,
      children: [
        widget_exports.Box({
          css_classes: ["spotlight-header"],
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 16,
          children: [widget_exports.Label({ label: "\uF002", style: "font-size: 1.8em; color: #a6adc8;" }), searchEntry]
        }),
        appsScroll
      ]
    })
  });
  win.connect("notify::visible", () => {
    if (win.visible) {
      spotlightQueryVar.set("");
      searchEntry.set_text("");
      searchEntry.grab_focus();
      if (appsScroll) appsScroll.visible = false;
      updateSpotlightList();
    }
  });
  return win;
}
function PowerMenuModal() {
  const { TOP } = Astal6.WindowAnchor;
  const mkPowerBtn = (cls, icon, label, cmd) => widget_exports.Button({
    css_classes: ["power-action-btn", cls],
    child: widget_exports.Box({
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 10,
      children: [
        widget_exports.Label({ label: icon, style: "font-size: 2.2em;" }),
        widget_exports.Label({ label })
      ]
    }),
    onClicked: () => {
      toggleExclusiveModal("powermenu");
      execAsync(cmd).catch(() => {
      });
    }
  });
  const grid = widget_exports.Box({
    orientation: Gtk4.Orientation.HORIZONTAL,
    spacing: 18,
    halign: Gtk4.Align.CENTER,
    children: [
      mkPowerBtn("lock", "\uF023", "Blocca", ["sh", "-c", "loginctl lock-session 2>/dev/null || true"]),
      mkPowerBtn("suspend", "\uF186", "Sospendi", ["systemctl", "suspend"]),
      mkPowerBtn("reboot", "\uF01E", "Riavvia", ["systemctl", "reboot"]),
      mkPowerBtn("shutdown", "\u23FB", "Spegni", ["systemctl", "poweroff"])
    ]
  });
  return PopupWindow({
    name: "powermenu",
    namespace: "powermenu",
    application: app_default,
    anchor: TOP,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 140,
    child: widget_exports.Box({
      css_classes: ["modal-box", "powermenu-overlay"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 26,
      children: [
        widget_exports.Label({ label: "Gestione Sessione \u2022 Ermete OS", css_classes: ["powermenu-title"], halign: Gtk4.Align.CENTER }),
        grid,
        widget_exports.Button({
          css_classes: ["power-cancel-btn"],
          label: "Annulla e Torna al Desktop",
          halign: Gtk4.Align.CENTER,
          onClicked: () => toggleExclusiveModal("powermenu")
        })
      ]
    })
  });
}
function CalendarModal() {
  const { TOP } = Astal6.WindowAnchor;
  const calendar = new Gtk4.Calendar({ css_classes: ["matshell-calendar"] });
  return PopupWindow({
    name: "calendar",
    namespace: "calendar",
    application: app_default,
    anchor: TOP,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    marginTop: 40,
    child: widget_exports.Box({
      css_classes: ["modal-box"],
      orientation: Gtk4.Orientation.VERTICAL,
      spacing: 16,
      children: [
        widget_exports.Label({ label: "Calendario e Eventi", css_classes: ["dongle-title"], xalign: 0 }),
        calendar
      ]
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/notifications.ts
import AstalNotifd from "gi://AstalNotifd";
var activePopups = /* @__PURE__ */ new Map();
function NotificationWidget(notif) {
  const icon = notif.image || notif.app_icon || "dialog-information-symbolic";
  return widget_exports.Box({
    css_classes: ["notification-box"],
    orientation: Gtk4.Orientation.HORIZONTAL,
    spacing: 12,
    children: [
      widget_exports.Image({
        icon_name: icon,
        pixel_size: 48,
        css_classes: ["notification-icon"]
      }),
      widget_exports.Box({
        orientation: Gtk4.Orientation.VERTICAL,
        valign: Gtk4.Align.CENTER,
        children: [
          widget_exports.Label({
            css_classes: ["notification-summary"],
            label: notif.summary,
            xalign: 0,
            wrap: true,
            max_width_chars: 40
          }),
          widget_exports.Label({
            css_classes: ["notification-body"],
            label: notif.body,
            xalign: 0,
            wrap: true,
            max_width_chars: 40
          }),
          widget_exports.Box({
            orientation: Gtk4.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8,
            children: notif.get_actions().map((a) => widget_exports.Button({
              label: a.label,
              hexpand: true,
              css_classes: ["notification-action-btn"],
              onClicked: () => {
                notif.invoke(a.id);
                notif.dismiss();
              }
            }))
          })
        ]
      })
    ]
  });
}
function NotificationPopups() {
  const notifd = AstalNotifd.get_default();
  const list = widget_exports.Box({
    orientation: Gtk4.Orientation.VERTICAL,
    spacing: 10,
    css_classes: ["notification-list"],
    children: []
  });
  const win = widget_exports.Window({
    name: "notifications",
    namespace: "notifications",
    anchor: Astal6.WindowAnchor.TOP | Astal6.WindowAnchor.RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    layer: Astal6.Layer.OVERLAY,
    margin_top: 60,
    margin_right: 12,
    visible: false,
    child: list
  });
  notifd.connect("notified", (_, id) => {
    const notif = notifd.get_notification(id);
    if (!notif) return;
    const widget = NotificationWidget(notif);
    activePopups.set(id, widget);
    list.append(widget);
    win.visible = true;
    default2.timeout_add(default2.PRIORITY_DEFAULT, 5e3, () => {
      if (activePopups.has(id)) {
        const w = activePopups.get(id);
        if (w) list.remove(w);
        activePopups.delete(id);
        if (activePopups.size === 0) win.visible = false;
      }
      return default2.SOURCE_REMOVE;
    });
  });
  notifd.connect("resolved", (_, id) => {
    const widget = activePopups.get(id);
    if (widget) {
      list.remove(widget);
      activePopups.delete(id);
    }
    if (activePopups.size === 0) {
      win.visible = false;
    }
  });
  return win;
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/polkit.ts
import Auth from "gi://AstalAuth";
var currentPrompt = Variable("");
var currentAuthId = Variable("");
function PolkitAgent() {
  try {
    if (!Auth || !Auth.Polkit || typeof Auth.Polkit.get_default !== "function") {
      return;
    }
    const auth = Auth.Polkit.get_default();
    auth.connect("request", (agent, id, msg, icon) => {
      const win = app_default.get_window("polkit");
      if (win) {
        currentPrompt.set(msg);
        currentAuthId.set(id);
        win.visible = true;
      }
    });
  } catch (e) {
    console.error("No Polkit Authentication Agent backend available in AstalAuth: ", e);
  }
}
function PolkitModal() {
  return PopupWindow({
    name: "polkit",
    namespace: "polkit",
    application: app_default,
    anchor: Astal6.WindowAnchor.NONE,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: false,
    child: widget_exports.Box({
      orientation: Gtk4.Orientation.VERTICAL,
      css_classes: ["polkit-modal-container"],
      children: [
        widget_exports.Label({
          label: "\u{1F512} Autenticazione Richiesta",
          css_classes: ["polkit-title"]
        }),
        widget_exports.Label({
          label: bind(currentPrompt),
          css_classes: ["polkit-msg"],
          wrap: true
        }),
        widget_exports.Entry({
          visibility: false,
          placeholder_text: "Password",
          onActivate: (self) => {
            const id = currentAuthId.get();
            if (id) {
              Auth.Polkit.get_default().reply(id, self.text);
            }
            self.text = "";
            app_default.get_window("polkit").visible = false;
          }
        }),
        widget_exports.Button({
          label: "Annulla",
          css: "margin-top: 1rem;",
          onClicked: () => {
            const id = currentAuthId.get();
            if (id) {
              Auth.Polkit.get_default().reply(id, "");
            }
            app_default.get_window("polkit").visible = false;
          }
        })
      ]
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/udisks.ts
function UDisksMonitor() {
  console.log("Inizializzazione UDisks2 Monitor (AGS Native)...");
  Variable("").watch("udisksctl monitor", (out) => {
    if (out.includes("Added /org/freedesktop/UDisks2/block_devices/") && !out.includes("loop")) {
      const match = out.match(/block_devices\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        const dev = match[1];
        setTimeout(() => {
          execAsync(["lsblk", "-J", "-o", "NAME,MOUNTPOINT,TYPE,SIZE", `/dev/${dev}`]).then((res) => {
            try {
              const parsed = JSON.parse(res);
              const block = parsed.blockdevices?.[0];
              if (block && block.type === "part" && !block.mountpoints?.[0] && !block.mountpoint) {
                console.log(`Rilevata nuova partizione: ${dev}`);
                execAsync([
                  "notify-send",
                  "-A",
                  "mount=Monta",
                  "-A",
                  "ignore=Ignora",
                  "-u",
                  "normal",
                  "-i",
                  "drive-removable-media",
                  "Nuova Memoria Rilevata",
                  `Trovato volume /dev/${dev} (${block.size}).
Vuoi montarlo ora?`
                ]).then((action) => {
                  if (action.trim() === "mount") {
                    execAsync(["udisksctl", "mount", "-b", `/dev/${dev}`]).then((mountOut) => {
                      execAsync(["notify-send", "-i", "drive-harddisk", "Volume Montato", mountOut.trim()]);
                    }).catch((err) => {
                      execAsync(["notify-send", "-i", "dialog-error", "Errore", "Impossibile montare il volume."]);
                    });
                  }
                }).catch(() => {
                });
              }
            } catch (e) {
              console.error("Errore nel parsing lsblk: ", e);
            }
          }).catch(() => {
          });
        }, 1e3);
      }
    }
    return out;
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/clipboard.ts
var clipboardItems = Variable([]).poll(1e3, ["/home/ermete/.local/bin/cliphist", "list"], (out) => {
  return out.split("\n").filter((l) => l.trim() !== "");
});
function ClipboardModal() {
  return PopupWindow({
    name: "clipboard",
    namespace: "clipboard",
    child: widget_exports.Box({
      orientation: Gtk4.Orientation.VERTICAL,
      css_classes: ["clipboard-modal-container"],
      children: [
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          margin_bottom: 16,
          children: [
            widget_exports.Label({
              label: "\u{1F4CB} Cronologia Appunti",
              css_classes: ["clipboard-title"],
              hexpand: true,
              xalign: 0
            }),
            widget_exports.Button({
              label: "\u{1F5D1}\uFE0F Pulisci",
              css_classes: ["clipboard-wipe-btn"],
              onClicked: () => {
                execAsync(["/home/ermete/.local/bin/cliphist", "wipe"]).catch((err) => console.error(err));
              }
            })
          ]
        }),
        (() => {
          const scroll = new Gtk4.ScrolledWindow({
            vexpand: true,
            css_classes: ["clipboard-scroll"],
            hscrollbar_policy: Gtk4.PolicyType.NEVER,
            vscrollbar_policy: Gtk4.PolicyType.AUTOMATIC
          });
          const innerBox = widget_exports.Box({
            orientation: Gtk4.Orientation.VERTICAL,
            spacing: 8,
            children: bind(clipboardItems).as((items) => {
              if (items.length === 0) {
                return [widget_exports.Label({
                  label: "Nessun elemento copiato.",
                  css_classes: ["clipboard-empty-msg"]
                })];
              }
              return items.map((item) => {
                const parts = item.split("	");
                const preview = parts.slice(1).join("	") || "Oggetto binario / Immagine";
                return widget_exports.Button({
                  css_classes: ["clipboard-item-btn"],
                  child: widget_exports.Label({
                    label: preview,
                    truncate: true,
                    max_width_chars: 50,
                    xalign: 0
                  }),
                  onClicked: () => {
                    const safeItem = item.replace(/'/g, "'\\''");
                    execAsync(["sh", "-c", `echo -n '${safeItem}' | /home/ermete/.local/bin/cliphist decode | wl-copy`]).then(() => toggleExclusiveModal("clipboard")).catch((err) => console.error("Errore decodifica: ", err));
                  }
                });
              });
            })
          });
          scroll.set_child(innerBox);
          return scroll;
        })()
      ]
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/geoclue.ts
import Gio2 from "gi://Gio";
var geoclueRequest = Variable(null);
function initGeoclueAgent() {
  const xml = `
    <node>
      <interface name="org.freedesktop.GeoClue2.Agent">
        <method name="AuthorizeApp">
          <arg type="s" name="desktop_id" direction="in"/>
          <arg type="u" name="req_level" direction="in"/>
          <arg type="b" name="authorized" direction="out"/>
        </method>
        <property name="MaxAccuracyLevel" type="u" access="read"/>
      </interface>
    </node>`;
  const nodeInfo = Gio2.DBusNodeInfo.new_for_xml(xml);
  if (!nodeInfo || nodeInfo.interfaces.length === 0) {
    console.error("[Geoclue] Failed to parse XML");
    return;
  }
  const interfaceInfo = nodeInfo.interfaces[0];
  Gio2.bus_get(Gio2.BusType.SYSTEM, null, (source, res) => {
    try {
      const conn = Gio2.bus_get_finish(res);
      conn.register_object(
        "/org/freedesktop/GeoClue2/Agent",
        interfaceInfo,
        // Method call handler
        (conn2, sender, objectPath, interfaceName, methodName, parameters, invocation) => {
          if (methodName === "AuthorizeApp") {
            const [desktopId, reqLevel] = parameters.deep_unpack();
            console.log(`[Geoclue] App ${desktopId} requests location (level ${reqLevel})`);
            geoclueRequest.set({ app: desktopId, level: reqLevel, invocation });
            const win = app_default.get_window("geoclue-modal");
            if (win) win.visible = true;
          }
        },
        // Get Property handler
        (conn2, sender, objectPath, interfaceName, propertyName) => {
          if (propertyName === "MaxAccuracyLevel") {
            return new default2.Variant("u", 4);
          }
          return null;
        },
        // Set Property handler
        null
      );
      conn.call(
        "org.freedesktop.GeoClue2",
        "/org/freedesktop/GeoClue2/Manager",
        "org.freedesktop.GeoClue2.Manager",
        "AddAgent",
        new default2.Variant("(s)", ["geoclue-demo-agent"]),
        null,
        Gio2.DBusCallFlags.NONE,
        -1,
        null,
        (conn2, res2) => {
          try {
            conn2.call_finish(res2);
            console.log("[Geoclue] Agent natively integrated in AGS!");
          } catch (e) {
            console.error("[Geoclue] AddAgent failed (whitelist issue?): " + e);
          }
        }
      );
    } catch (e) {
      console.error("[Geoclue] Bus connection error: " + e);
    }
  });
}
function GeoclueModal() {
  return PopupWindow({
    name: "geoclue-modal",
    child: widget_exports.Box({
      orientation: Gtk4.Orientation.VERTICAL,
      css_classes: ["polkit-modal-container"],
      children: [
        widget_exports.Label({
          label: "\u{1F4CD} Geolocalizzazione",
          css_classes: ["polkit-title"]
        }),
        widget_exports.Label({
          label: bind(geoclueRequest).as(
            (req) => req ? `L'applicazione "${req.app}" sta richiedendo l'accesso alla tua posizione geografica.
Consenti questa azione?` : "Nessuna richiesta attiva."
          ),
          css_classes: ["polkit-msg"],
          wrap: true
        }),
        widget_exports.Box({
          orientation: Gtk4.Orientation.HORIZONTAL,
          spacing: 12,
          margin_top: 10,
          children: [
            widget_exports.Button({
              label: "\u274C Rifiuta",
              hexpand: true,
              css_classes: ["geoclue-btn-deny"],
              onClicked: () => {
                const req = geoclueRequest.get();
                if (req && req.invocation) {
                  req.invocation.return_value(new default2.Variant("(b)", [false]));
                  geoclueRequest.set(null);
                }
                const win = app_default.get_window("geoclue-modal");
                if (win) win.visible = false;
              }
            }),
            widget_exports.Button({
              label: "\u2705 Consenti",
              hexpand: true,
              css_classes: ["geoclue-btn-allow"],
              onClicked: () => {
                const req = geoclueRequest.get();
                if (req && req.invocation) {
                  req.invocation.return_value(new default2.Variant("(b)", [true]));
                  geoclueRequest.set(null);
                }
                const win = app_default.get_window("geoclue-modal");
                if (win) win.visible = false;
              }
            })
          ]
        })
      ]
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/greeter.ts
import Greet from "gi://AstalGreet?version=0.1";
var password = Variable("");
var isAuthenticating = Variable(false);
var errorMessage = Variable("");
var entryWidget = null;
default2.unix_signal_add(default2.PRIORITY_DEFAULT, 15, () => {
  app_default.quit();
  return default2.SOURCE_REMOVE;
});
function doLogin(entry) {
  if (isAuthenticating.get()) return;
  const pass = password.get();
  if (!pass) {
    errorMessage.set("Inserisci la password");
    return;
  }
  isAuthenticating.set(true);
  errorMessage.set("Verifica credenziali...");
  const resetUI = (msg = "Password errata. Riprova.") => {
    try {
      const cancel = new Greet.CancelSession();
      cancel.send(() => {
      });
    } catch (e) {
    }
    isAuthenticating.set(false);
    password.set("");
    const w = entry || entryWidget;
    if (w) w.text = "";
    errorMessage.set(msg);
  };
  try {
    const preCancel = new Greet.CancelSession();
    preCancel.send(() => {
      startAuthSession();
    });
  } catch (e) {
    startAuthSession();
  }
  function startAuthSession() {
    const req1 = new Greet.CreateSession({ username: "ermete" });
    req1.send((s1, r1) => {
      try {
        const ans1 = req1.send_finish(r1);
        if (ans1 instanceof Greet.Error) {
          resetUI("Errore di sessione. Riprova.");
          return;
        }
        const req2 = new Greet.PostAuthMesssage({ response: pass });
        req2.send((s2, r2) => {
          try {
            const ans2 = req2.send_finish(r2);
            if (ans2 instanceof Greet.Error) {
              resetUI("Password errata. Riprova.");
              return;
            }
            const req3 = new Greet.StartSession({ cmd: ["/etc/greetd/ermete-session"] });
            req3.send((s3, r3) => {
              try {
                const ans3 = req3.send_finish(r3);
                if (ans3 instanceof Greet.Error) {
                  resetUI("Errore avvio sessione.");
                } else {
                  default2.spawn_command_line_async("killall -9 niri gjs ags");
                }
              } catch (e) {
                resetUI("Errore avvio sessione.");
              }
            });
          } catch (e) {
            resetUI("Password errata. Riprova.");
          }
        });
      } catch (e) {
        resetUI("Errore di sessione. Riprova.");
      }
    });
  }
}
function Greeter() {
  return widget_exports.Window({
    name: "greeter",
    application: app_default,
    anchor: Astal6.WindowAnchor.TOP | Astal6.WindowAnchor.BOTTOM | Astal6.WindowAnchor.LEFT | Astal6.WindowAnchor.RIGHT,
    exclusivity: Astal6.Exclusivity.IGNORE,
    keymode: Astal6.Keymode.EXCLUSIVE,
    visible: true,
    layer: Astal6.Layer.OVERLAY,
    css_classes: ["greeter-bg"],
    child: widget_exports.CenterBox({
      centerWidget: widget_exports.Box({
        orientation: Gtk4.Orientation.VERTICAL,
        css_classes: ["greeter-box"],
        valign: Gtk4.Align.CENTER,
        halign: Gtk4.Align.CENTER,
        children: [
          widget_exports.Label({
            label: "Ermete OS",
            css_classes: ["greeter-title"]
          }),
          widget_exports.Label({
            label: "Ermete",
            css_classes: ["greeter-user"]
          }),
          widget_exports.Entry({
            placeholder_text: "Password di accesso...",
            visibility: false,
            onChanged: (self) => password.set(self.text),
            onActivate: (self) => doLogin(self),
            sensitive: bind(isAuthenticating).as((a) => !a),
            setup: (self) => {
              entryWidget = self;
              self.grab_focus();
            }
          }),
          widget_exports.Label({
            label: bind(errorMessage),
            css_classes: ["greeter-error"],
            visible: bind(errorMessage).as((e) => e.length > 0)
          }),
          widget_exports.Button({
            label: bind(isAuthenticating).as((a) => a ? "Autenticazione in corso..." : "Accedi"),
            onClicked: doLogin,
            css_classes: ["greeter-login-btn"],
            sensitive: bind(isAuthenticating).as((a) => !a)
          })
        ]
      })
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/SOURCES/etc/skel/.config/ags/app.ts
import GLib2 from "gi://GLib";
var isGreeter = !!GLib2.getenv("GREETD_SOCK");
var defaultCss = isGreeter ? "/etc/skel/.config/ags/style/main.css" : `${GLib2.get_home_dir()}/.config/ags/style.css`;
app_default.start({
  css: defaultCss,
  main() {
    if (isGreeter) {
      Greeter();
      return;
    }
    const configDir = GLib2.get_home_dir() + "/.config/ags";
    const cssPath = configDir + "/style.css";
    const scssPath = configDir + "/style/main.scss";
    const componentsPath = configDir + "/style/components/normal";
    try {
      const { execSync: execSync4 } = imports.gi.GLib;
      if (GLib2.file_test(scssPath, GLib2.FileTest.EXISTS)) {
        console.log(`Compiling SCSS from ${scssPath}`);
        GLib2.spawn_command_line_sync(`sass --load-path="${componentsPath}" "${scssPath}" "${cssPath}"`);
      }
    } catch (e) {
      console.error("Failed to compile SCSS:", e);
    }
    app_default.get_monitors().forEach((mon, idx) => TopBar(mon, idx));
    NotificationPopups();
    WifiModal();
    BtModal();
    AudioModal();
    QuickSettingsModal();
    ErmeteSettingsModal();
    MediaPlayerDongle();
    SysMonitorDongle();
    LauncherModal();
    SpotlightModal();
    PowerMenuModal();
    CalendarModal();
    PolkitModal();
    PolkitAgent();
    UDisksMonitor();
    ClipboardModal();
    GeoclueModal();
    initGeoclueAgent();
    allModals.forEach((name) => {
      const win = app_default.get_window(name);
      if (win) {
        const keyCtrl = new Gtk4.EventControllerKey();
        keyCtrl.connect("key-pressed", (ctrl, keyval) => {
          if (keyval === 65307) {
            win.visible = false;
            return true;
          }
          return false;
        });
        win.add_controller(keyCtrl);
      }
    });
    updateAppList();
    scanWifi();
    scanBt();
    updateAudioHub();
  },
  requestHandler(args, res) {
    const cmd = args[0];
    if (cmd === "toggle") {
      const target = args[1] || "quick-settings";
      const actual = target === "control-center" ? "quick-settings" : target;
      toggleExclusiveModal(actual);
      res(`Toggled ${actual}`);
    } else {
      res("Unknown command");
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9ndGs0L2luZGV4LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Vzci9zaGFyZS9hc3RhbC9nanMvdmFyaWFibGUudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9iaW5kaW5nLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Vzci9zaGFyZS9hc3RhbC9nanMvdGltZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi91c3Ivc2hhcmUvYXN0YWwvZ2pzL3Byb2Nlc3MudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9fYXN0YWwudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9ndGs0L2FzdGFsaWZ5LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Vzci9zaGFyZS9hc3RhbC9nanMvZ3RrNC9hcHAudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9vdmVycmlkZXMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9fYXBwLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Vzci9zaGFyZS9hc3RhbC9nanMvZ3RrNC93aWRnZXQudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9pbmRleC50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi91c3Ivc2hhcmUvYXN0YWwvZ2pzL2ZpbGUudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdXNyL3NoYXJlL2FzdGFsL2dqcy9nb2JqZWN0LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Zhci9ob21lL2VybWV0ZS9HRU1JTkkvZXJtZXRlL2VybWV0ZS1mb3JnZS9zcGVjcy9lcm1ldGUtZGVza3RvcC11aS9TT1VSQ0VTL2V0Yy9za2VsLy5jb25maWcvYWdzL3N0YXRlLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Zhci9ob21lL2VybWV0ZS9HRU1JTkkvZXJtZXRlL2VybWV0ZS1mb3JnZS9zcGVjcy9lcm1ldGUtZGVza3RvcC11aS9TT1VSQ0VTL2V0Yy9za2VsLy5jb25maWcvYWdzL21vZGFscy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi92YXIvaG9tZS9lcm1ldGUvR0VNSU5JL2VybWV0ZS9lcm1ldGUtZm9yZ2Uvc3BlY3MvZXJtZXRlLWRlc2t0b3AtdWkvU09VUkNFUy9ldGMvc2tlbC8uY29uZmlnL2Fncy9maXJld2FsbC50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi92YXIvaG9tZS9lcm1ldGUvR0VNSU5JL2VybWV0ZS9lcm1ldGUtZm9yZ2Uvc3BlY3MvZXJtZXRlLWRlc2t0b3AtdWkvU09VUkNFUy9ldGMvc2tlbC8uY29uZmlnL2Fncy91cGRhdGVyLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Zhci9ob21lL2VybWV0ZS9HRU1JTkkvZXJtZXRlL2VybWV0ZS1mb3JnZS9zcGVjcy9lcm1ldGUtZGVza3RvcC11aS9TT1VSQ0VTL2V0Yy9za2VsLy5jb25maWcvYWdzL25vdGlmaWNhdGlvbnMudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdmFyL2hvbWUvZXJtZXRlL0dFTUlOSS9lcm1ldGUvZXJtZXRlLWZvcmdlL3NwZWNzL2VybWV0ZS1kZXNrdG9wLXVpL1NPVVJDRVMvZXRjL3NrZWwvLmNvbmZpZy9hZ3MvcG9sa2l0LnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Zhci9ob21lL2VybWV0ZS9HRU1JTkkvZXJtZXRlL2VybWV0ZS1mb3JnZS9zcGVjcy9lcm1ldGUtZGVza3RvcC11aS9TT1VSQ0VTL2V0Yy9za2VsLy5jb25maWcvYWdzL3VkaXNrcy50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi92YXIvaG9tZS9lcm1ldGUvR0VNSU5JL2VybWV0ZS9lcm1ldGUtZm9yZ2Uvc3BlY3MvZXJtZXRlLWRlc2t0b3AtdWkvU09VUkNFUy9ldGMvc2tlbC8uY29uZmlnL2Fncy9jbGlwYm9hcmQudHMiLCAiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vdmFyL2hvbWUvZXJtZXRlL0dFTUlOSS9lcm1ldGUvZXJtZXRlLWZvcmdlL3NwZWNzL2VybWV0ZS1kZXNrdG9wLXVpL1NPVVJDRVMvZXRjL3NrZWwvLmNvbmZpZy9hZ3MvZ2VvY2x1ZS50cyIsICIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi92YXIvaG9tZS9lcm1ldGUvR0VNSU5JL2VybWV0ZS9lcm1ldGUtZm9yZ2Uvc3BlY3MvZXJtZXRlLWRlc2t0b3AtdWkvU09VUkNFUy9ldGMvc2tlbC8uY29uZmlnL2Fncy9ncmVldGVyLnRzIiwgIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Zhci9ob21lL2VybWV0ZS9HRU1JTkkvZXJtZXRlL2VybWV0ZS1mb3JnZS9zcGVjcy9lcm1ldGUtZGVza3RvcC11aS9TT1VSQ0VTL2V0Yy9za2VsLy5jb25maWcvYWdzL2FwcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IEFzdGFsIGZyb20gXCJnaTovL0FzdGFsP3ZlcnNpb249NC4wXCJcbmltcG9ydCBHdGsgZnJvbSBcImdpOi8vR3RrP3ZlcnNpb249NC4wXCJcbmltcG9ydCBHZGsgZnJvbSBcImdpOi8vR2RrP3ZlcnNpb249NC4wXCJcbmltcG9ydCBhc3RhbGlmeSwgeyB0eXBlIENvbnN0cnVjdFByb3BzIH0gZnJvbSBcIi4vYXN0YWxpZnkuanNcIlxuXG5leHBvcnQgeyBBc3RhbCwgR3RrLCBHZGsgfVxuZXhwb3J0IHsgZGVmYXVsdCBhcyBBcHAgfSBmcm9tIFwiLi9hcHAuanNcIlxuZXhwb3J0IHsgYXN0YWxpZnksIENvbnN0cnVjdFByb3BzIH1cbmV4cG9ydCAqIGFzIFdpZGdldCBmcm9tIFwiLi93aWRnZXQuanNcIlxuZXhwb3J0IHsgaG9vayB9IGZyb20gXCIuLi9fYXN0YWxcIlxuIiwgImltcG9ydCBBc3RhbCBmcm9tIFwiZ2k6Ly9Bc3RhbElPXCJcbmltcG9ydCBCaW5kaW5nLCB7IHR5cGUgQ29ubmVjdGFibGUsIHR5cGUgU3Vic2NyaWJhYmxlIH0gZnJvbSBcIi4vYmluZGluZy5qc1wiXG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL3RpbWUuanNcIlxuaW1wb3J0IHsgZXhlY0FzeW5jLCBzdWJwcm9jZXNzIH0gZnJvbSBcIi4vcHJvY2Vzcy5qc1wiXG5cbmNsYXNzIFZhcmlhYmxlV3JhcHBlcjxUPiBleHRlbmRzIEZ1bmN0aW9uIHtcbiAgICBwcml2YXRlIHZhcmlhYmxlITogQXN0YWwuVmFyaWFibGVCYXNlXG4gICAgcHJpdmF0ZSBlcnJIYW5kbGVyPyA9IGNvbnNvbGUuZXJyb3JcblxuICAgIHByaXZhdGUgX3ZhbHVlOiBUXG4gICAgcHJpdmF0ZSBfcG9sbD86IEFzdGFsLlRpbWVcbiAgICBwcml2YXRlIF93YXRjaD86IEFzdGFsLlByb2Nlc3NcblxuICAgIHByaXZhdGUgcG9sbEludGVydmFsID0gMTAwMFxuICAgIHByaXZhdGUgcG9sbEV4ZWM/OiBzdHJpbmdbXSB8IHN0cmluZ1xuICAgIHByaXZhdGUgcG9sbFRyYW5zZm9ybT86IChzdGRvdXQ6IHN0cmluZywgcHJldjogVCkgPT4gVFxuICAgIHByaXZhdGUgcG9sbEZuPzogKHByZXY6IFQpID0+IFQgfCBQcm9taXNlPFQ+XG5cbiAgICBwcml2YXRlIHdhdGNoVHJhbnNmb3JtPzogKHN0ZG91dDogc3RyaW5nLCBwcmV2OiBUKSA9PiBUXG4gICAgcHJpdmF0ZSB3YXRjaEV4ZWM/OiBzdHJpbmdbXSB8IHN0cmluZ1xuXG4gICAgY29uc3RydWN0b3IoaW5pdDogVCkge1xuICAgICAgICBzdXBlcigpXG4gICAgICAgIHRoaXMuX3ZhbHVlID0gaW5pdFxuICAgICAgICB0aGlzLnZhcmlhYmxlID0gbmV3IEFzdGFsLlZhcmlhYmxlQmFzZSgpXG4gICAgICAgIHRoaXMudmFyaWFibGUuY29ubmVjdChcImRyb3BwZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zdG9wV2F0Y2goKVxuICAgICAgICAgICAgdGhpcy5zdG9wUG9sbCgpXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMudmFyaWFibGUuY29ubmVjdChcImVycm9yXCIsIChfLCBlcnIpID0+IHRoaXMuZXJySGFuZGxlcj8uKGVycikpXG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodGhpcywge1xuICAgICAgICAgICAgYXBwbHk6ICh0YXJnZXQsIF8sIGFyZ3MpID0+IHRhcmdldC5fY2FsbChhcmdzWzBdKSxcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBwcml2YXRlIF9jYWxsPFIgPSBUPih0cmFuc2Zvcm0/OiAodmFsdWU6IFQpID0+IFIpOiBCaW5kaW5nPFI+IHtcbiAgICAgICAgY29uc3QgYiA9IEJpbmRpbmcuYmluZCh0aGlzKVxuICAgICAgICByZXR1cm4gdHJhbnNmb3JtID8gYi5hcyh0cmFuc2Zvcm0pIDogYiBhcyB1bmtub3duIGFzIEJpbmRpbmc8Uj5cbiAgICB9XG5cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhgVmFyaWFibGU8JHt0aGlzLmdldCgpfT5gKVxuICAgIH1cblxuICAgIGdldCgpOiBUIHsgcmV0dXJuIHRoaXMuX3ZhbHVlIH1cbiAgICBzZXQodmFsdWU6IFQpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy52YXJpYWJsZS5lbWl0KFwiY2hhbmdlZFwiKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnRQb2xsKCkge1xuICAgICAgICBpZiAodGhpcy5fcG9sbClcbiAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgIGlmICh0aGlzLnBvbGxGbikge1xuICAgICAgICAgICAgdGhpcy5fcG9sbCA9IGludGVydmFsKHRoaXMucG9sbEludGVydmFsLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdiA9IHRoaXMucG9sbEZuISh0aGlzLmdldCgpKVxuICAgICAgICAgICAgICAgIGlmICh2IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAgICAgICAgICAgICB2LnRoZW4odiA9PiB0aGlzLnNldCh2KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy52YXJpYWJsZS5lbWl0KFwiZXJyb3JcIiwgZXJyKSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldCh2KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wb2xsRXhlYykge1xuICAgICAgICAgICAgdGhpcy5fcG9sbCA9IGludGVydmFsKHRoaXMucG9sbEludGVydmFsLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgZXhlY0FzeW5jKHRoaXMucG9sbEV4ZWMhKVxuICAgICAgICAgICAgICAgICAgICAudGhlbih2ID0+IHRoaXMuc2V0KHRoaXMucG9sbFRyYW5zZm9ybSEodiwgdGhpcy5nZXQoKSkpKVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHRoaXMudmFyaWFibGUuZW1pdChcImVycm9yXCIsIGVycikpXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnRXYXRjaCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3dhdGNoKVxuICAgICAgICAgICAgcmV0dXJuXG5cbiAgICAgICAgdGhpcy5fd2F0Y2ggPSBzdWJwcm9jZXNzKHtcbiAgICAgICAgICAgIGNtZDogdGhpcy53YXRjaEV4ZWMhLFxuICAgICAgICAgICAgb3V0OiBvdXQgPT4gdGhpcy5zZXQodGhpcy53YXRjaFRyYW5zZm9ybSEob3V0LCB0aGlzLmdldCgpKSksXG4gICAgICAgICAgICBlcnI6IGVyciA9PiB0aGlzLnZhcmlhYmxlLmVtaXQoXCJlcnJvclwiLCBlcnIpLFxuICAgICAgICB9KVxuICAgIH1cblxuICAgIHN0b3BQb2xsKCkge1xuICAgICAgICB0aGlzLl9wb2xsPy5jYW5jZWwoKVxuICAgICAgICBkZWxldGUgdGhpcy5fcG9sbFxuICAgIH1cblxuICAgIHN0b3BXYXRjaCgpIHtcbiAgICAgICAgdGhpcy5fd2F0Y2g/LmtpbGwoKVxuICAgICAgICBkZWxldGUgdGhpcy5fd2F0Y2hcbiAgICB9XG5cbiAgICBpc1BvbGxpbmcoKSB7IHJldHVybiAhIXRoaXMuX3BvbGwgfVxuICAgIGlzV2F0Y2hpbmcoKSB7IHJldHVybiAhIXRoaXMuX3dhdGNoIH1cblxuICAgIGRyb3AoKSB7XG4gICAgICAgIHRoaXMudmFyaWFibGUuZW1pdChcImRyb3BwZWRcIilcbiAgICB9XG5cbiAgICBvbkRyb3BwZWQoY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICAgICAgdGhpcy52YXJpYWJsZS5jb25uZWN0KFwiZHJvcHBlZFwiLCBjYWxsYmFjaylcbiAgICAgICAgcmV0dXJuIHRoaXMgYXMgdW5rbm93biBhcyBWYXJpYWJsZTxUPlxuICAgIH1cblxuICAgIG9uRXJyb3IoY2FsbGJhY2s6IChlcnI6IHN0cmluZykgPT4gdm9pZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5lcnJIYW5kbGVyXG4gICAgICAgIHRoaXMudmFyaWFibGUuY29ubmVjdChcImVycm9yXCIsIChfLCBlcnIpID0+IGNhbGxiYWNrKGVycikpXG4gICAgICAgIHJldHVybiB0aGlzIGFzIHVua25vd24gYXMgVmFyaWFibGU8VD5cbiAgICB9XG5cbiAgICBzdWJzY3JpYmUoY2FsbGJhY2s6ICh2YWx1ZTogVCkgPT4gdm9pZCkge1xuICAgICAgICBjb25zdCBpZCA9IHRoaXMudmFyaWFibGUuY29ubmVjdChcImNoYW5nZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgY2FsbGJhY2sodGhpcy5nZXQoKSlcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuICgpID0+IHRoaXMudmFyaWFibGUuZGlzY29ubmVjdChpZClcbiAgICB9XG5cbiAgICBwb2xsKFxuICAgICAgICBpbnRlcnZhbDogbnVtYmVyLFxuICAgICAgICBleGVjOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICAgICAgdHJhbnNmb3JtPzogKHN0ZG91dDogc3RyaW5nLCBwcmV2OiBUKSA9PiBUXG4gICAgKTogVmFyaWFibGU8VD5cblxuICAgIHBvbGwoXG4gICAgICAgIGludGVydmFsOiBudW1iZXIsXG4gICAgICAgIGNhbGxiYWNrOiAocHJldjogVCkgPT4gVCB8IFByb21pc2U8VD5cbiAgICApOiBWYXJpYWJsZTxUPlxuXG4gICAgcG9sbChcbiAgICAgICAgaW50ZXJ2YWw6IG51bWJlcixcbiAgICAgICAgZXhlYzogc3RyaW5nIHwgc3RyaW5nW10gfCAoKHByZXY6IFQpID0+IFQgfCBQcm9taXNlPFQ+KSxcbiAgICAgICAgdHJhbnNmb3JtOiAoc3Rkb3V0OiBzdHJpbmcsIHByZXY6IFQpID0+IFQgPSBvdXQgPT4gb3V0IGFzIFQsXG4gICAgKSB7XG4gICAgICAgIHRoaXMuc3RvcFBvbGwoKVxuICAgICAgICB0aGlzLnBvbGxJbnRlcnZhbCA9IGludGVydmFsXG4gICAgICAgIHRoaXMucG9sbFRyYW5zZm9ybSA9IHRyYW5zZm9ybVxuICAgICAgICBpZiAodHlwZW9mIGV4ZWMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgdGhpcy5wb2xsRm4gPSBleGVjXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wb2xsRXhlY1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wb2xsRXhlYyA9IGV4ZWNcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBvbGxGblxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhcnRQb2xsKClcbiAgICAgICAgcmV0dXJuIHRoaXMgYXMgdW5rbm93biBhcyBWYXJpYWJsZTxUPlxuICAgIH1cblxuICAgIHdhdGNoKFxuICAgICAgICBleGVjOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICAgICAgdHJhbnNmb3JtOiAoc3Rkb3V0OiBzdHJpbmcsIHByZXY6IFQpID0+IFQgPSBvdXQgPT4gb3V0IGFzIFQsXG4gICAgKSB7XG4gICAgICAgIHRoaXMuc3RvcFdhdGNoKClcbiAgICAgICAgdGhpcy53YXRjaEV4ZWMgPSBleGVjXG4gICAgICAgIHRoaXMud2F0Y2hUcmFuc2Zvcm0gPSB0cmFuc2Zvcm1cbiAgICAgICAgdGhpcy5zdGFydFdhdGNoKClcbiAgICAgICAgcmV0dXJuIHRoaXMgYXMgdW5rbm93biBhcyBWYXJpYWJsZTxUPlxuICAgIH1cblxuICAgIG9ic2VydmUoXG4gICAgICAgIG9ianM6IEFycmF5PFtvYmo6IENvbm5lY3RhYmxlLCBzaWduYWw6IHN0cmluZ10+LFxuICAgICAgICBjYWxsYmFjazogKC4uLmFyZ3M6IGFueVtdKSA9PiBULFxuICAgICk6IFZhcmlhYmxlPFQ+XG5cbiAgICBvYnNlcnZlKFxuICAgICAgICBvYmo6IENvbm5lY3RhYmxlLFxuICAgICAgICBzaWduYWw6IHN0cmluZyxcbiAgICAgICAgY2FsbGJhY2s6ICguLi5hcmdzOiBhbnlbXSkgPT4gVCxcbiAgICApOiBWYXJpYWJsZTxUPlxuXG4gICAgb2JzZXJ2ZShcbiAgICAgICAgb2JqczogQ29ubmVjdGFibGUgfCBBcnJheTxbb2JqOiBDb25uZWN0YWJsZSwgc2lnbmFsOiBzdHJpbmddPixcbiAgICAgICAgc2lnT3JGbjogc3RyaW5nIHwgKChvYmo6IENvbm5lY3RhYmxlLCAuLi5hcmdzOiBhbnlbXSkgPT4gVCksXG4gICAgICAgIGNhbGxiYWNrPzogKG9iajogQ29ubmVjdGFibGUsIC4uLmFyZ3M6IGFueVtdKSA9PiBULFxuICAgICkge1xuICAgICAgICBjb25zdCBmID0gdHlwZW9mIHNpZ09yRm4gPT09IFwiZnVuY3Rpb25cIiA/IHNpZ09yRm4gOiBjYWxsYmFjayA/PyAoKCkgPT4gdGhpcy5nZXQoKSlcbiAgICAgICAgY29uc3Qgc2V0ID0gKG9iajogQ29ubmVjdGFibGUsIC4uLmFyZ3M6IGFueVtdKSA9PiB0aGlzLnNldChmKG9iaiwgLi4uYXJncykpXG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqcykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgb2JqIG9mIG9ianMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBbbywgc10gPSBvYmpcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IG8uY29ubmVjdChzLCBzZXQpXG4gICAgICAgICAgICAgICAgdGhpcy5vbkRyb3BwZWQoKCkgPT4gby5kaXNjb25uZWN0KGlkKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2lnT3JGbiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gb2Jqcy5jb25uZWN0KHNpZ09yRm4sIHNldClcbiAgICAgICAgICAgICAgICB0aGlzLm9uRHJvcHBlZCgoKSA9PiBvYmpzLmRpc2Nvbm5lY3QoaWQpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMgYXMgdW5rbm93biBhcyBWYXJpYWJsZTxUPlxuICAgIH1cblxuICAgIHN0YXRpYyBkZXJpdmU8XG4gICAgICAgIGNvbnN0IERlcHMgZXh0ZW5kcyBBcnJheTxTdWJzY3JpYmFibGU8YW55Pj4sXG4gICAgICAgIEFyZ3MgZXh0ZW5kcyB7XG4gICAgICAgICAgICBbSyBpbiBrZXlvZiBEZXBzXTogRGVwc1tLXSBleHRlbmRzIFN1YnNjcmliYWJsZTxpbmZlciBUPiA/IFQgOiBuZXZlclxuICAgICAgICB9LFxuICAgICAgICBWID0gQXJncyxcbiAgICA+KGRlcHM6IERlcHMsIGZuOiAoLi4uYXJnczogQXJncykgPT4gViA9ICguLi5hcmdzKSA9PiBhcmdzIGFzIHVua25vd24gYXMgVikge1xuICAgICAgICBjb25zdCB1cGRhdGUgPSAoKSA9PiBmbiguLi5kZXBzLm1hcChkID0+IGQuZ2V0KCkpIGFzIEFyZ3MpXG4gICAgICAgIGNvbnN0IGRlcml2ZWQgPSBuZXcgVmFyaWFibGUodXBkYXRlKCkpXG4gICAgICAgIGNvbnN0IHVuc3VicyA9IGRlcHMubWFwKGRlcCA9PiBkZXAuc3Vic2NyaWJlKCgpID0+IGRlcml2ZWQuc2V0KHVwZGF0ZSgpKSkpXG4gICAgICAgIGRlcml2ZWQub25Ecm9wcGVkKCgpID0+IHVuc3Vicy5tYXAodW5zdWIgPT4gdW5zdWIoKSkpXG4gICAgICAgIHJldHVybiBkZXJpdmVkXG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZhcmlhYmxlPFQ+IGV4dGVuZHMgT21pdDxWYXJpYWJsZVdyYXBwZXI8VD4sIFwiYmluZFwiPiB7XG4gICAgPFI+KHRyYW5zZm9ybTogKHZhbHVlOiBUKSA9PiBSKTogQmluZGluZzxSPlxuICAgICgpOiBCaW5kaW5nPFQ+XG59XG5cbmV4cG9ydCBjb25zdCBWYXJpYWJsZSA9IG5ldyBQcm94eShWYXJpYWJsZVdyYXBwZXIgYXMgYW55LCB7XG4gICAgYXBwbHk6IChfdCwgX2EsIGFyZ3MpID0+IG5ldyBWYXJpYWJsZVdyYXBwZXIoYXJnc1swXSksXG59KSBhcyB7XG4gICAgZGVyaXZlOiB0eXBlb2YgVmFyaWFibGVXcmFwcGVyW1wiZGVyaXZlXCJdXG4gICAgPFQ+KGluaXQ6IFQpOiBWYXJpYWJsZTxUPlxuICAgIG5ldzxUPihpbml0OiBUKTogVmFyaWFibGU8VD5cbn1cblxuZXhwb3J0IGNvbnN0IHsgZGVyaXZlIH0gPSBWYXJpYWJsZVxuZXhwb3J0IGRlZmF1bHQgVmFyaWFibGVcbiIsICJleHBvcnQgY29uc3Qgc25ha2VpZnkgPSAoc3RyOiBzdHJpbmcpID0+IHN0clxuICAgIC5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCBcIiQxXyQyXCIpXG4gICAgLnJlcGxhY2VBbGwoXCItXCIsIFwiX1wiKVxuICAgIC50b0xvd2VyQ2FzZSgpXG5cbmV4cG9ydCBjb25zdCBrZWJhYmlmeSA9IChzdHI6IHN0cmluZykgPT4gc3RyXG4gICAgLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csIFwiJDEtJDJcIilcbiAgICAucmVwbGFjZUFsbChcIl9cIiwgXCItXCIpXG4gICAgLnRvTG93ZXJDYXNlKClcblxuZXhwb3J0IGludGVyZmFjZSBTdWJzY3JpYmFibGU8VCA9IHVua25vd24+IHtcbiAgICBzdWJzY3JpYmUoY2FsbGJhY2s6ICh2YWx1ZTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWRcbiAgICBnZXQoKTogVFxuICAgIFtrZXk6IHN0cmluZ106IGFueVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbm5lY3RhYmxlIHtcbiAgICBjb25uZWN0KHNpZ25hbDogc3RyaW5nLCBjYWxsYmFjazogKC4uLmFyZ3M6IGFueVtdKSA9PiB1bmtub3duKTogbnVtYmVyXG4gICAgZGlzY29ubmVjdChpZDogbnVtYmVyKTogdm9pZFxuICAgIFtrZXk6IHN0cmluZ106IGFueVxufVxuXG5leHBvcnQgY2xhc3MgQmluZGluZzxWYWx1ZT4ge1xuICAgIHByaXZhdGUgdHJhbnNmb3JtRm4gPSAodjogYW55KSA9PiB2XG5cbiAgICAjZW1pdHRlcjogU3Vic2NyaWJhYmxlPFZhbHVlPiB8IENvbm5lY3RhYmxlXG4gICAgI3Byb3A/OiBzdHJpbmdcblxuICAgIHN0YXRpYyBiaW5kPFxuICAgICAgICBUIGV4dGVuZHMgQ29ubmVjdGFibGUsXG4gICAgICAgIFAgZXh0ZW5kcyBrZXlvZiBULFxuICAgID4ob2JqZWN0OiBULCBwcm9wZXJ0eTogUCk6IEJpbmRpbmc8VFtQXT5cblxuICAgIHN0YXRpYyBiaW5kPFQ+KG9iamVjdDogU3Vic2NyaWJhYmxlPFQ+KTogQmluZGluZzxUPlxuXG4gICAgc3RhdGljIGJpbmQoZW1pdHRlcjogQ29ubmVjdGFibGUgfCBTdWJzY3JpYmFibGUsIHByb3A/OiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBCaW5kaW5nKGVtaXR0ZXIsIHByb3ApXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihlbWl0dGVyOiBDb25uZWN0YWJsZSB8IFN1YnNjcmliYWJsZTxWYWx1ZT4sIHByb3A/OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy4jZW1pdHRlciA9IGVtaXR0ZXJcbiAgICAgICAgdGhpcy4jcHJvcCA9IHByb3AgJiYga2ViYWJpZnkocHJvcClcbiAgICB9XG5cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBCaW5kaW5nPCR7dGhpcy4jZW1pdHRlcn0ke3RoaXMuI3Byb3AgPyBgLCBcIiR7dGhpcy4jcHJvcH1cImAgOiBcIlwifT5gXG4gICAgfVxuXG4gICAgYXM8VD4oZm46ICh2OiBWYWx1ZSkgPT4gVCk6IEJpbmRpbmc8VD4ge1xuICAgICAgICBjb25zdCBiaW5kID0gbmV3IEJpbmRpbmcodGhpcy4jZW1pdHRlciwgdGhpcy4jcHJvcClcbiAgICAgICAgYmluZC50cmFuc2Zvcm1GbiA9ICh2OiBWYWx1ZSkgPT4gZm4odGhpcy50cmFuc2Zvcm1Gbih2KSlcbiAgICAgICAgcmV0dXJuIGJpbmQgYXMgdW5rbm93biBhcyBCaW5kaW5nPFQ+XG4gICAgfVxuXG4gICAgZ2V0KCk6IFZhbHVlIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLiNlbWl0dGVyLmdldCA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtRm4odGhpcy4jZW1pdHRlci5nZXQoKSlcblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuI3Byb3AgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdldHRlciA9IGBnZXRfJHtzbmFrZWlmeSh0aGlzLiNwcm9wKX1gXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuI2VtaXR0ZXJbZ2V0dGVyXSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybUZuKHRoaXMuI2VtaXR0ZXJbZ2V0dGVyXSgpKVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm1Gbih0aGlzLiNlbWl0dGVyW3RoaXMuI3Byb3BdKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgRXJyb3IoXCJjYW4gbm90IGdldCB2YWx1ZSBvZiBiaW5kaW5nXCIpXG4gICAgfVxuXG4gICAgc3Vic2NyaWJlKGNhbGxiYWNrOiAodmFsdWU6IFZhbHVlKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy4jZW1pdHRlci5zdWJzY3JpYmUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuI2VtaXR0ZXIuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayh0aGlzLmdldCgpKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy4jZW1pdHRlci5jb25uZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25hbCA9IGBub3RpZnk6OiR7dGhpcy4jcHJvcH1gXG4gICAgICAgICAgICBjb25zdCBpZCA9IHRoaXMuI2VtaXR0ZXIuY29ubmVjdChzaWduYWwsICgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayh0aGlzLmdldCgpKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgKHRoaXMuI2VtaXR0ZXIuZGlzY29ubmVjdCBhcyBDb25uZWN0YWJsZVtcImRpc2Nvbm5lY3RcIl0pKGlkKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IEVycm9yKGAke3RoaXMuI2VtaXR0ZXJ9IGlzIG5vdCBiaW5kYWJsZWApXG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgeyBiaW5kIH0gPSBCaW5kaW5nXG5leHBvcnQgZGVmYXVsdCBCaW5kaW5nXG4iLCAiaW1wb3J0IEFzdGFsIGZyb20gXCJnaTovL0FzdGFsSU9cIlxuXG5leHBvcnQgdHlwZSBUaW1lID0gQXN0YWwuVGltZVxuZXhwb3J0IGNvbnN0IFRpbWUgPSBBc3RhbC5UaW1lXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnZhbChpbnRlcnZhbDogbnVtYmVyLCBjYWxsYmFjaz86ICgpID0+IHZvaWQpIHtcbiAgICByZXR1cm4gQXN0YWwuVGltZS5pbnRlcnZhbChpbnRlcnZhbCwgKCkgPT4gdm9pZCBjYWxsYmFjaz8uKCkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0aW1lb3V0KHRpbWVvdXQ6IG51bWJlciwgY2FsbGJhY2s/OiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIEFzdGFsLlRpbWUudGltZW91dCh0aW1lb3V0LCAoKSA9PiB2b2lkIGNhbGxiYWNrPy4oKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlkbGUoY2FsbGJhY2s/OiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIEFzdGFsLlRpbWUuaWRsZSgoKSA9PiB2b2lkIGNhbGxiYWNrPy4oKSlcbn1cbiIsICJpbXBvcnQgQXN0YWwgZnJvbSBcImdpOi8vQXN0YWxJT1wiXG5cbnR5cGUgQXJncyA9IHtcbiAgICBjbWQ6IHN0cmluZyB8IHN0cmluZ1tdXG4gICAgb3V0PzogKHN0ZG91dDogc3RyaW5nKSA9PiB2b2lkXG4gICAgZXJyPzogKHN0ZGVycjogc3RyaW5nKSA9PiB2b2lkXG59XG5cbmV4cG9ydCB0eXBlIFByb2Nlc3MgPSBBc3RhbC5Qcm9jZXNzXG5leHBvcnQgY29uc3QgUHJvY2VzcyA9IEFzdGFsLlByb2Nlc3NcblxuZXhwb3J0IGZ1bmN0aW9uIHN1YnByb2Nlc3MoYXJnczogQXJncyk6IEFzdGFsLlByb2Nlc3NcblxuZXhwb3J0IGZ1bmN0aW9uIHN1YnByb2Nlc3MoXG4gICAgY21kOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBvbk91dD86IChzdGRvdXQ6IHN0cmluZykgPT4gdm9pZCxcbiAgICBvbkVycj86IChzdGRlcnI6IHN0cmluZykgPT4gdm9pZCxcbik6IEFzdGFsLlByb2Nlc3NcblxuZXhwb3J0IGZ1bmN0aW9uIHN1YnByb2Nlc3MoXG4gICAgYXJnc09yQ21kOiBBcmdzIHwgc3RyaW5nIHwgc3RyaW5nW10sXG4gICAgb25PdXQ6IChzdGRvdXQ6IHN0cmluZykgPT4gdm9pZCA9IHByaW50LFxuICAgIG9uRXJyOiAoc3RkZXJyOiBzdHJpbmcpID0+IHZvaWQgPSBwcmludGVycixcbikge1xuICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5pc0FycmF5KGFyZ3NPckNtZCkgfHwgdHlwZW9mIGFyZ3NPckNtZCA9PT0gXCJzdHJpbmdcIlxuICAgIGNvbnN0IHsgY21kLCBlcnIsIG91dCB9ID0ge1xuICAgICAgICBjbWQ6IGFyZ3MgPyBhcmdzT3JDbWQgOiBhcmdzT3JDbWQuY21kLFxuICAgICAgICBlcnI6IGFyZ3MgPyBvbkVyciA6IGFyZ3NPckNtZC5lcnIgfHwgb25FcnIsXG4gICAgICAgIG91dDogYXJncyA/IG9uT3V0IDogYXJnc09yQ21kLm91dCB8fCBvbk91dCxcbiAgICB9XG5cbiAgICBjb25zdCBwcm9jID0gQXJyYXkuaXNBcnJheShjbWQpXG4gICAgICAgID8gQXN0YWwuUHJvY2Vzcy5zdWJwcm9jZXNzdihjbWQpXG4gICAgICAgIDogQXN0YWwuUHJvY2Vzcy5zdWJwcm9jZXNzKGNtZClcblxuICAgIHByb2MuY29ubmVjdChcInN0ZG91dFwiLCAoXywgc3Rkb3V0OiBzdHJpbmcpID0+IG91dChzdGRvdXQpKVxuICAgIHByb2MuY29ubmVjdChcInN0ZGVyclwiLCAoXywgc3RkZXJyOiBzdHJpbmcpID0+IGVycihzdGRlcnIpKVxuICAgIHJldHVybiBwcm9jXG59XG5cbi8qKiBAdGhyb3dzIHtHTGliLkVycm9yfSBUaHJvd3Mgc3RkZXJyICovXG5leHBvcnQgZnVuY3Rpb24gZXhlYyhjbWQ6IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoY21kKVxuICAgICAgICA/IEFzdGFsLlByb2Nlc3MuZXhlY3YoY21kKVxuICAgICAgICA6IEFzdGFsLlByb2Nlc3MuZXhlYyhjbWQpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleGVjQXN5bmMoY21kOiBzdHJpbmcgfCBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY21kKSkge1xuICAgICAgICAgICAgQXN0YWwuUHJvY2Vzcy5leGVjX2FzeW5jdihjbWQsIChfLCByZXMpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKEFzdGFsLlByb2Nlc3MuZXhlY19hc3luY3ZfZmluaXNoKHJlcykpXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBBc3RhbC5Qcm9jZXNzLmV4ZWNfYXN5bmMoY21kLCAoXywgcmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShBc3RhbC5Qcm9jZXNzLmV4ZWNfZmluaXNoKHJlcykpXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9KVxufVxuIiwgImltcG9ydCBWYXJpYWJsZSBmcm9tIFwiLi92YXJpYWJsZS5qc1wiXG5pbXBvcnQgeyBleGVjQXN5bmMgfSBmcm9tIFwiLi9wcm9jZXNzLmpzXCJcbmltcG9ydCBCaW5kaW5nLCB7IENvbm5lY3RhYmxlLCBrZWJhYmlmeSwgc25ha2VpZnksIFN1YnNjcmliYWJsZSB9IGZyb20gXCIuL2JpbmRpbmcuanNcIlxuXG5leHBvcnQgY29uc3Qgbm9JbXBsaWNpdERlc3Ryb3kgPSBTeW1ib2woXCJubyBubyBpbXBsaWNpdCBkZXN0cm95XCIpXG5leHBvcnQgY29uc3Qgc2V0Q2hpbGRyZW4gPSBTeW1ib2woXCJjaGlsZHJlbiBzZXR0ZXIgbWV0aG9kXCIpXG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZUJpbmRpbmdzKGFycmF5OiBhbnlbXSkge1xuICAgIGZ1bmN0aW9uIGdldFZhbHVlcyguLi5hcmdzOiBhbnlbXSkge1xuICAgICAgICBsZXQgaSA9IDBcbiAgICAgICAgcmV0dXJuIGFycmF5Lm1hcCh2YWx1ZSA9PiB2YWx1ZSBpbnN0YW5jZW9mIEJpbmRpbmdcbiAgICAgICAgICAgID8gYXJnc1tpKytdXG4gICAgICAgICAgICA6IHZhbHVlLFxuICAgICAgICApXG4gICAgfVxuXG4gICAgY29uc3QgYmluZGluZ3MgPSBhcnJheS5maWx0ZXIoaSA9PiBpIGluc3RhbmNlb2YgQmluZGluZylcblxuICAgIGlmIChiaW5kaW5ncy5sZW5ndGggPT09IDApXG4gICAgICAgIHJldHVybiBhcnJheVxuXG4gICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PT0gMSlcbiAgICAgICAgcmV0dXJuIGJpbmRpbmdzWzBdLmFzKGdldFZhbHVlcylcblxuICAgIHJldHVybiBWYXJpYWJsZS5kZXJpdmUoYmluZGluZ3MsIGdldFZhbHVlcykoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0UHJvcChvYmo6IGFueSwgcHJvcDogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2V0dGVyID0gYHNldF8ke3NuYWtlaWZ5KHByb3ApfWBcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpbc2V0dGVyXSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuIG9ialtzZXR0ZXJdKHZhbHVlKVxuXG4gICAgICAgIHJldHVybiAob2JqW3Byb3BdID0gdmFsdWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgY291bGQgbm90IHNldCBwcm9wZXJ0eSBcIiR7cHJvcH1cIiBvbiAke29ian06YCwgZXJyb3IpXG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBCaW5kYWJsZVByb3BzPFQ+ID0ge1xuICAgIFtLIGluIGtleW9mIFRdOiBCaW5kaW5nPFRbS10+IHwgVFtLXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvb2s8V2lkZ2V0IGV4dGVuZHMgQ29ubmVjdGFibGU+KFxuICAgIHdpZGdldDogV2lkZ2V0LFxuICAgIG9iamVjdDogQ29ubmVjdGFibGUgfCBTdWJzY3JpYmFibGUsXG4gICAgc2lnbmFsT3JDYWxsYmFjazogc3RyaW5nIHwgKChzZWxmOiBXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKSxcbiAgICBjYWxsYmFjaz86IChzZWxmOiBXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkLFxuKSB7XG4gICAgaWYgKHR5cGVvZiBvYmplY3QuY29ubmVjdCA9PT0gXCJmdW5jdGlvblwiICYmIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IGlkID0gb2JqZWN0LmNvbm5lY3Qoc2lnbmFsT3JDYWxsYmFjaywgKF86IGFueSwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sod2lkZ2V0LCAuLi5hcmdzKVxuICAgICAgICB9KVxuICAgICAgICB3aWRnZXQuY29ubmVjdChcImRlc3Ryb3lcIiwgKCkgPT4ge1xuICAgICAgICAgICAgKG9iamVjdC5kaXNjb25uZWN0IGFzIENvbm5lY3RhYmxlW1wiZGlzY29ubmVjdFwiXSkoaWQpXG4gICAgICAgIH0pXG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0LnN1YnNjcmliZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBzaWduYWxPckNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgY29uc3QgdW5zdWIgPSBvYmplY3Quc3Vic2NyaWJlKCguLi5hcmdzOiB1bmtub3duW10pID0+IHtcbiAgICAgICAgICAgIHNpZ25hbE9yQ2FsbGJhY2sod2lkZ2V0LCAuLi5hcmdzKVxuICAgICAgICB9KVxuICAgICAgICB3aWRnZXQuY29ubmVjdChcImRlc3Ryb3lcIiwgdW5zdWIpXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3RydWN0PFdpZGdldCBleHRlbmRzIENvbm5lY3RhYmxlICYgeyBbc2V0Q2hpbGRyZW5dOiAoY2hpbGRyZW46IGFueVtdKSA9PiB2b2lkIH0+KHdpZGdldDogV2lkZ2V0LCBjb25maWc6IGFueSkge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgICBsZXQgeyBzZXR1cCwgY2hpbGQsIGNoaWxkcmVuID0gW10sIC4uLnByb3BzIH0gPSBjb25maWdcblxuICAgIGlmIChjaGlsZHJlbiBpbnN0YW5jZW9mIEJpbmRpbmcpIHtcbiAgICAgICAgY2hpbGRyZW4gPSBbY2hpbGRyZW5dXG4gICAgfVxuXG4gICAgaWYgKGNoaWxkKSB7XG4gICAgICAgIGNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpXG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIHVuZGVmaW5lZCB2YWx1ZXNcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwcm9wcykpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBwcm9wc1trZXldXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb2xsZWN0IGJpbmRpbmdzXG4gICAgY29uc3QgYmluZGluZ3M6IEFycmF5PFtzdHJpbmcsIEJpbmRpbmc8YW55Pl0+ID0gT2JqZWN0XG4gICAgICAgIC5rZXlzKHByb3BzKVxuICAgICAgICAucmVkdWNlKChhY2M6IGFueSwgcHJvcCkgPT4ge1xuICAgICAgICAgICAgaWYgKHByb3BzW3Byb3BdIGluc3RhbmNlb2YgQmluZGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpbmRpbmcgPSBwcm9wc1twcm9wXVxuICAgICAgICAgICAgICAgIGRlbGV0ZSBwcm9wc1twcm9wXVxuICAgICAgICAgICAgICAgIHJldHVybiBbLi4uYWNjLCBbcHJvcCwgYmluZGluZ11dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYWNjXG4gICAgICAgIH0sIFtdKVxuXG4gICAgLy8gY29sbGVjdCBzaWduYWwgaGFuZGxlcnNcbiAgICBjb25zdCBvbkhhbmRsZXJzOiBBcnJheTxbc3RyaW5nLCBzdHJpbmcgfCAoKCkgPT4gdW5rbm93bildPiA9IE9iamVjdFxuICAgICAgICAua2V5cyhwcm9wcylcbiAgICAgICAgLnJlZHVjZSgoYWNjOiBhbnksIGtleSkgPT4ge1xuICAgICAgICAgICAgaWYgKGtleS5zdGFydHNXaXRoKFwib25cIikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzaWcgPSBrZWJhYmlmeShrZXkpLnNwbGl0KFwiLVwiKS5zbGljZSgxKS5qb2luKFwiLVwiKVxuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBwcm9wc1trZXldXG4gICAgICAgICAgICAgICAgZGVsZXRlIHByb3BzW2tleV1cbiAgICAgICAgICAgICAgICByZXR1cm4gWy4uLmFjYywgW3NpZywgaGFuZGxlcl1dXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYWNjXG4gICAgICAgIH0sIFtdKVxuXG4gICAgLy8gc2V0IGNoaWxkcmVuXG4gICAgY29uc3QgbWVyZ2VkQ2hpbGRyZW4gPSBtZXJnZUJpbmRpbmdzKGNoaWxkcmVuLmZsYXQoSW5maW5pdHkpKVxuICAgIGlmIChtZXJnZWRDaGlsZHJlbiBpbnN0YW5jZW9mIEJpbmRpbmcpIHtcbiAgICAgICAgd2lkZ2V0W3NldENoaWxkcmVuXShtZXJnZWRDaGlsZHJlbi5nZXQoKSlcbiAgICAgICAgd2lkZ2V0LmNvbm5lY3QoXCJkZXN0cm95XCIsIG1lcmdlZENoaWxkcmVuLnN1YnNjcmliZSgodikgPT4ge1xuICAgICAgICAgICAgd2lkZ2V0W3NldENoaWxkcmVuXSh2KVxuICAgICAgICB9KSlcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAobWVyZ2VkQ2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgd2lkZ2V0W3NldENoaWxkcmVuXShtZXJnZWRDaGlsZHJlbilcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldHVwIHNpZ25hbCBoYW5kbGVyc1xuICAgIGZvciAoY29uc3QgW3NpZ25hbCwgY2FsbGJhY2tdIG9mIG9uSGFuZGxlcnMpIHtcbiAgICAgICAgY29uc3Qgc2lnID0gc2lnbmFsLnN0YXJ0c1dpdGgoXCJub3RpZnlcIilcbiAgICAgICAgICAgID8gc2lnbmFsLnJlcGxhY2UoXCItXCIsIFwiOjpcIilcbiAgICAgICAgICAgIDogc2lnbmFsXG5cbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB3aWRnZXQuY29ubmVjdChzaWcsIGNhbGxiYWNrKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2lkZ2V0LmNvbm5lY3Qoc2lnLCAoKSA9PiBleGVjQXN5bmMoY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgLnRoZW4ocHJpbnQpLmNhdGNoKGNvbnNvbGUuZXJyb3IpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYmluZGluZ3MgaGFuZGxlcnNcbiAgICBmb3IgKGNvbnN0IFtwcm9wLCBiaW5kaW5nXSBvZiBiaW5kaW5ncykge1xuICAgICAgICBpZiAocHJvcCA9PT0gXCJjaGlsZFwiIHx8IHByb3AgPT09IFwiY2hpbGRyZW5cIikge1xuICAgICAgICAgICAgd2lkZ2V0LmNvbm5lY3QoXCJkZXN0cm95XCIsIGJpbmRpbmcuc3Vic2NyaWJlKCh2OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICB3aWRnZXRbc2V0Q2hpbGRyZW5dKHYpXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgICB3aWRnZXQuY29ubmVjdChcImRlc3Ryb3lcIiwgYmluZGluZy5zdWJzY3JpYmUoKHY6IGFueSkgPT4ge1xuICAgICAgICAgICAgc2V0UHJvcCh3aWRnZXQsIHByb3AsIHYpXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRQcm9wKHdpZGdldCwgcHJvcCwgYmluZGluZy5nZXQoKSlcbiAgICB9XG5cbiAgICAvLyBmaWx0ZXIgdW5kZWZpbmVkIHZhbHVlc1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHByb3BzKSkge1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsZXRlIHByb3BzW2tleV1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIE9iamVjdC5hc3NpZ24od2lkZ2V0LCBwcm9wcylcbiAgICBzZXR1cD8uKHdpZGdldClcbiAgICByZXR1cm4gd2lkZ2V0XG59XG5cbmZ1bmN0aW9uIGlzQXJyb3dGdW5jdGlvbihmdW5jOiBhbnkpOiBmdW5jIGlzIChhcmdzOiBhbnkpID0+IGFueSB7XG4gICAgcmV0dXJuICFPYmplY3QuaGFzT3duKGZ1bmMsIFwicHJvdG90eXBlXCIpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBqc3goXG4gICAgY3RvcnM6IFJlY29yZDxzdHJpbmcsIHsgbmV3KHByb3BzOiBhbnkpOiBhbnkgfSB8ICgocHJvcHM6IGFueSkgPT4gYW55KT4sXG4gICAgY3Rvcjogc3RyaW5nIHwgKChwcm9wczogYW55KSA9PiBhbnkpIHwgeyBuZXcocHJvcHM6IGFueSk6IGFueSB9LFxuICAgIHsgY2hpbGRyZW4sIC4uLnByb3BzIH06IGFueSxcbikge1xuICAgIGNoaWxkcmVuID8/PSBbXVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNoaWxkcmVuKSlcbiAgICAgICAgY2hpbGRyZW4gPSBbY2hpbGRyZW5dXG5cbiAgICBjaGlsZHJlbiA9IGNoaWxkcmVuLmZpbHRlcihCb29sZWFuKVxuXG4gICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA9PT0gMSlcbiAgICAgICAgcHJvcHMuY2hpbGQgPSBjaGlsZHJlblswXVxuICAgIGVsc2UgaWYgKGNoaWxkcmVuLmxlbmd0aCA+IDEpXG4gICAgICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRyZW5cblxuICAgIGlmICh0eXBlb2YgY3RvciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBpZiAoaXNBcnJvd0Z1bmN0aW9uKGN0b3JzW2N0b3JdKSlcbiAgICAgICAgICAgIHJldHVybiBjdG9yc1tjdG9yXShwcm9wcylcblxuICAgICAgICByZXR1cm4gbmV3IGN0b3JzW2N0b3JdKHByb3BzKVxuICAgIH1cblxuICAgIGlmIChpc0Fycm93RnVuY3Rpb24oY3RvcikpXG4gICAgICAgIHJldHVybiBjdG9yKHByb3BzKVxuXG4gICAgcmV0dXJuIG5ldyBjdG9yKHByb3BzKVxufVxuIiwgImltcG9ydCB7IG5vSW1wbGljaXREZXN0cm95LCBzZXRDaGlsZHJlbiwgdHlwZSBCaW5kYWJsZVByb3BzLCBjb25zdHJ1Y3QgfSBmcm9tIFwiLi4vX2FzdGFsLmpzXCJcbmltcG9ydCBHdGsgZnJvbSBcImdpOi8vR3RrP3ZlcnNpb249NC4wXCJcbmltcG9ydCBHZGsgZnJvbSBcImdpOi8vR2RrP3ZlcnNpb249NC4wXCJcbmltcG9ydCBCaW5kaW5nIGZyb20gXCIuLi9iaW5kaW5nLmpzXCJcblxuZXhwb3J0IGNvbnN0IHR5cGUgPSBTeW1ib2woXCJjaGlsZCB0eXBlXCIpXG5jb25zdCBkdW1teUJ1bGRlciA9IG5ldyBHdGsuQnVpbGRlclxuXG5mdW5jdGlvbiBfZ2V0Q2hpbGRyZW4od2lkZ2V0OiBHdGsuV2lkZ2V0KTogQXJyYXk8R3RrLldpZGdldD4ge1xuICAgIGlmIChcImdldF9jaGlsZFwiIGluIHdpZGdldCAmJiB0eXBlb2Ygd2lkZ2V0LmdldF9jaGlsZCA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIHdpZGdldC5nZXRfY2hpbGQoKSA/IFt3aWRnZXQuZ2V0X2NoaWxkKCldIDogW11cbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbjogQXJyYXk8R3RrLldpZGdldD4gPSBbXVxuICAgIGxldCBjaCA9IHdpZGdldC5nZXRfZmlyc3RfY2hpbGQoKVxuICAgIHdoaWxlIChjaCAhPT0gbnVsbCkge1xuICAgICAgICBjaGlsZHJlbi5wdXNoKGNoKVxuICAgICAgICBjaCA9IGNoLmdldF9uZXh0X3NpYmxpbmcoKVxuICAgIH1cbiAgICByZXR1cm4gY2hpbGRyZW5cbn1cblxuZnVuY3Rpb24gX3NldENoaWxkcmVuKHdpZGdldDogR3RrLldpZGdldCwgY2hpbGRyZW46IGFueVtdKSB7XG4gICAgY2hpbGRyZW4gPSBjaGlsZHJlbi5mbGF0KEluZmluaXR5KS5tYXAoY2ggPT4gY2ggaW5zdGFuY2VvZiBHdGsuV2lkZ2V0XG4gICAgICAgID8gY2hcbiAgICAgICAgOiBuZXcgR3RrLkxhYmVsKHsgdmlzaWJsZTogdHJ1ZSwgbGFiZWw6IFN0cmluZyhjaCkgfSkpXG5cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgICAgd2lkZ2V0LnZmdW5jX2FkZF9jaGlsZChcbiAgICAgICAgICAgIGR1bW15QnVsZGVyLFxuICAgICAgICAgICAgY2hpbGQsXG4gICAgICAgICAgICB0eXBlIGluIGNoaWxkID8gY2hpbGRbdHlwZV0gOiBudWxsLFxuICAgICAgICApXG4gICAgfVxufVxuXG50eXBlIENvbmZpZzxUIGV4dGVuZHMgR3RrLldpZGdldD4gPSB7XG4gICAgc2V0Q2hpbGRyZW4od2lkZ2V0OiBULCBjaGlsZHJlbjogYW55W10pOiB2b2lkXG4gICAgZ2V0Q2hpbGRyZW4od2lkZ2V0OiBUKTogQXJyYXk8R3RrLldpZGdldD5cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYXN0YWxpZnk8XG4gICAgV2lkZ2V0IGV4dGVuZHMgR3RrLldpZGdldCxcbiAgICBQcm9wcyBleHRlbmRzIEd0ay5XaWRnZXQuQ29uc3RydWN0b3JQcm9wcyA9IEd0ay5XaWRnZXQuQ29uc3RydWN0b3JQcm9wcyxcbiAgICBTaWduYWxzIGV4dGVuZHMgUmVjb3JkPGBvbiR7c3RyaW5nfWAsIEFycmF5PHVua25vd24+PiA9IFJlY29yZDxgb24ke3N0cmluZ31gLCBhbnlbXT4sXG4+KGNsczogeyBuZXcoLi4uYXJnczogYW55W10pOiBXaWRnZXQgfSwgY29uZmlnOiBQYXJ0aWFsPENvbmZpZzxXaWRnZXQ+PiA9IHt9KSB7XG4gICAgT2JqZWN0LmFzc2lnbihjbHMucHJvdG90eXBlLCB7XG4gICAgICAgIFtzZXRDaGlsZHJlbl0oY2hpbGRyZW46IGFueVtdKSB7XG4gICAgICAgICAgICBjb25zdCB3ID0gdGhpcyBhcyB1bmtub3duIGFzIFdpZGdldFxuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiAoY29uZmlnLmdldENoaWxkcmVuPy4odykgfHwgX2dldENoaWxkcmVuKHcpKSkge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEd0ay5XaWRnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQudW5wYXJlbnQoKVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNoaWxkcmVuLmluY2x1ZGVzKGNoaWxkKSAmJiBub0ltcGxpY2l0RGVzdHJveSBpbiB0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQucnVuX2Rpc3Bvc2UoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNvbmZpZy5zZXRDaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGNvbmZpZy5zZXRDaGlsZHJlbih3LCBjaGlsZHJlbilcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX3NldENoaWxkcmVuKHcsIGNoaWxkcmVuKVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgIH0pXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBbY2xzLm5hbWVdOiAoXG4gICAgICAgICAgICBwcm9wczogQ29uc3RydWN0UHJvcHM8V2lkZ2V0LCBQcm9wcywgU2lnbmFscz4gPSB7fSxcbiAgICAgICAgICAgIC4uLmNoaWxkcmVuOiBhbnlbXVxuICAgICAgICApOiBXaWRnZXQgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2lkZ2V0ID0gbmV3IGNscyhcImNzc05hbWVcIiBpbiBwcm9wcyA/IHsgY3NzTmFtZTogcHJvcHMuY3NzTmFtZSB9IDoge30pXG5cbiAgICAgICAgICAgIGlmIChcImNzc05hbWVcIiBpbiBwcm9wcykge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBwcm9wcy5jc3NOYW1lXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wcy5ub0ltcGxpY2l0RGVzdHJveSkge1xuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24od2lkZ2V0LCB7IFtub0ltcGxpY2l0RGVzdHJveV06IHRydWUgfSlcbiAgICAgICAgICAgICAgICBkZWxldGUgcHJvcHMubm9JbXBsaWNpdERlc3Ryb3lcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByb3BzLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKHdpZGdldCwgeyBbdHlwZV06IHByb3BzLnR5cGUgfSlcbiAgICAgICAgICAgICAgICBkZWxldGUgcHJvcHMudHlwZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24ocHJvcHMsIHsgY2hpbGRyZW4gfSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnN0cnVjdCh3aWRnZXQgYXMgYW55LCBzZXR1cENvbnRyb2xsZXJzKHdpZGdldCwgcHJvcHMgYXMgYW55KSlcbiAgICAgICAgfSxcbiAgICB9W2Nscy5uYW1lXVxufVxuXG50eXBlIFNpZ0hhbmRsZXI8XG4gICAgVyBleHRlbmRzIEluc3RhbmNlVHlwZTx0eXBlb2YgR3RrLldpZGdldD4sXG4gICAgQXJncyBleHRlbmRzIEFycmF5PHVua25vd24+LFxuPiA9ICgoc2VsZjogVywgLi4uYXJnczogQXJncykgPT4gdW5rbm93bikgfCBzdHJpbmcgfCBzdHJpbmdbXVxuXG5leHBvcnQgeyBCaW5kYWJsZVByb3BzIH1cbmV4cG9ydCB0eXBlIEJpbmRhYmxlQ2hpbGQgPSBHdGsuV2lkZ2V0IHwgQmluZGluZzxHdGsuV2lkZ2V0PlxuXG5leHBvcnQgdHlwZSBDb25zdHJ1Y3RQcm9wczxcbiAgICBTZWxmIGV4dGVuZHMgSW5zdGFuY2VUeXBlPHR5cGVvZiBHdGsuV2lkZ2V0PixcbiAgICBQcm9wcyBleHRlbmRzIEd0ay5XaWRnZXQuQ29uc3RydWN0b3JQcm9wcyxcbiAgICBTaWduYWxzIGV4dGVuZHMgUmVjb3JkPGBvbiR7c3RyaW5nfWAsIEFycmF5PHVua25vd24+PiA9IFJlY29yZDxgb24ke3N0cmluZ31gLCBhbnlbXT4sXG4+ID0gUGFydGlhbDx7XG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciBjYW4ndCBhc3NpZ24gdG8gdW5rbm93biwgYnV0IGl0IHdvcmtzIGFzIGV4cGVjdGVkIHRob3VnaFxuICAgIFtTIGluIGtleW9mIFNpZ25hbHNdOiBTaWdIYW5kbGVyPFNlbGYsIFNpZ25hbHNbU10+XG59PiAmIFBhcnRpYWw8e1xuICAgIFtLZXkgaW4gYG9uJHtzdHJpbmd9YF06IFNpZ0hhbmRsZXI8U2VsZiwgYW55W10+XG59PiAmIFBhcnRpYWw8QmluZGFibGVQcm9wczxPbWl0PFByb3BzLCBcImNzc05hbWVcIiB8IFwiY3NzX25hbWVcIj4+PiAmIHtcbiAgICBub0ltcGxpY2l0RGVzdHJveT86IHRydWVcbiAgICB0eXBlPzogc3RyaW5nXG4gICAgY3NzTmFtZT86IHN0cmluZ1xufSAmIEV2ZW50Q29udHJvbGxlcjxTZWxmPiAmIHtcbiAgICBvbkRlc3Ryb3k/OiAoc2VsZjogU2VsZikgPT4gdW5rbm93blxuICAgIHNldHVwPzogKHNlbGY6IFNlbGYpID0+IHZvaWRcbn1cblxudHlwZSBFdmVudENvbnRyb2xsZXI8U2VsZiBleHRlbmRzIEd0ay5XaWRnZXQ+ID0ge1xuICAgIG9uRm9jdXNFbnRlcj86IChzZWxmOiBTZWxmKSA9PiB2b2lkXG4gICAgb25Gb2N1c0xlYXZlPzogKHNlbGY6IFNlbGYpID0+IHZvaWRcblxuICAgIG9uS2V5UHJlc3NlZD86IChzZWxmOiBTZWxmLCBrZXl2YWw6IG51bWJlciwga2V5Y29kZTogbnVtYmVyLCBzdGF0ZTogR2RrLk1vZGlmaWVyVHlwZSkgPT4gdm9pZFxuICAgIG9uS2V5UmVsZWFzZWQ/OiAoc2VsZjogU2VsZiwga2V5dmFsOiBudW1iZXIsIGtleWNvZGU6IG51bWJlciwgc3RhdGU6IEdkay5Nb2RpZmllclR5cGUpID0+IHZvaWRcbiAgICBvbktleU1vZGlmaWVyPzogKHNlbGY6IFNlbGYsIHN0YXRlOiBHZGsuTW9kaWZpZXJUeXBlKSA9PiB2b2lkXG5cbiAgICBvbkxlZ2FjeT86IChzZWxmOiBTZWxmLCBldmVudDogR2RrLkV2ZW50KSA9PiB2b2lkXG4gICAgb25CdXR0b25QcmVzc2VkPzogKHNlbGY6IFNlbGYsIHN0YXRlOiBHZGsuQnV0dG9uRXZlbnQpID0+IHZvaWRcbiAgICBvbkJ1dHRvblJlbGVhc2VkPzogKHNlbGY6IFNlbGYsIHN0YXRlOiBHZGsuQnV0dG9uRXZlbnQpID0+IHZvaWRcblxuICAgIG9uSG92ZXJFbnRlcj86IChzZWxmOiBTZWxmLCB4OiBudW1iZXIsIHk6IG51bWJlcikgPT4gdm9pZFxuICAgIG9uSG92ZXJMZWF2ZT86IChzZWxmOiBTZWxmKSA9PiB2b2lkXG4gICAgb25Nb3Rpb24/OiAoc2VsZjogU2VsZiwgeDogbnVtYmVyLCB5OiBudW1iZXIpID0+IHZvaWRcblxuICAgIG9uU2Nyb2xsPzogKHNlbGY6IFNlbGYsIGR4OiBudW1iZXIsIGR5OiBudW1iZXIpID0+IHZvaWRcbiAgICBvblNjcm9sbERlY2VsZXJhdGU/OiAoc2VsZjogU2VsZiwgdmVsX3g6IG51bWJlciwgdmVsX3k6IG51bWJlcikgPT4gdm9pZFxufVxuXG5mdW5jdGlvbiBzZXR1cENvbnRyb2xsZXJzPFQ+KHdpZGdldDogR3RrLldpZGdldCwge1xuICAgIG9uRm9jdXNFbnRlcixcbiAgICBvbkZvY3VzTGVhdmUsXG4gICAgb25LZXlQcmVzc2VkLFxuICAgIG9uS2V5UmVsZWFzZWQsXG4gICAgb25LZXlNb2RpZmllcixcbiAgICBvbkxlZ2FjeSxcbiAgICBvbkJ1dHRvblByZXNzZWQsXG4gICAgb25CdXR0b25SZWxlYXNlZCxcbiAgICBvbkhvdmVyRW50ZXIsXG4gICAgb25Ib3ZlckxlYXZlLFxuICAgIG9uTW90aW9uLFxuICAgIG9uU2Nyb2xsLFxuICAgIG9uU2Nyb2xsRGVjZWxlcmF0ZSxcbiAgICAuLi5wcm9wc1xufTogRXZlbnRDb250cm9sbGVyPEd0ay5XaWRnZXQ+ICYgVCkge1xuICAgIGlmIChvbkZvY3VzRW50ZXIgfHwgb25Gb2N1c0xlYXZlKSB7XG4gICAgICAgIGNvbnN0IGZvY3VzID0gbmV3IEd0ay5FdmVudENvbnRyb2xsZXJGb2N1c1xuICAgICAgICB3aWRnZXQuYWRkX2NvbnRyb2xsZXIoZm9jdXMpXG5cbiAgICAgICAgaWYgKG9uRm9jdXNFbnRlcilcbiAgICAgICAgICAgIGZvY3VzLmNvbm5lY3QoXCJlbnRlclwiLCAoKSA9PiBvbkZvY3VzRW50ZXIod2lkZ2V0KSlcblxuICAgICAgICBpZiAob25Gb2N1c0xlYXZlKVxuICAgICAgICAgICAgZm9jdXMuY29ubmVjdChcImxlYXZlXCIsICgpID0+IG9uRm9jdXNMZWF2ZSh3aWRnZXQpKVxuICAgIH1cblxuICAgIGlmIChvbktleVByZXNzZWQgfHwgb25LZXlSZWxlYXNlZCB8fCBvbktleU1vZGlmaWVyKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IG5ldyBHdGsuRXZlbnRDb250cm9sbGVyS2V5XG4gICAgICAgIHdpZGdldC5hZGRfY29udHJvbGxlcihrZXkpXG5cbiAgICAgICAgaWYgKG9uS2V5UHJlc3NlZClcbiAgICAgICAgICAgIGtleS5jb25uZWN0KFwia2V5LXByZXNzZWRcIiwgKF8sIHZhbCwgY29kZSwgc3RhdGUpID0+IG9uS2V5UHJlc3NlZCh3aWRnZXQsIHZhbCwgY29kZSwgc3RhdGUpKVxuXG4gICAgICAgIGlmIChvbktleVJlbGVhc2VkKVxuICAgICAgICAgICAga2V5LmNvbm5lY3QoXCJrZXktcmVsZWFzZWRcIiwgKF8sIHZhbCwgY29kZSwgc3RhdGUpID0+IG9uS2V5UmVsZWFzZWQod2lkZ2V0LCB2YWwsIGNvZGUsIHN0YXRlKSlcblxuICAgICAgICBpZiAob25LZXlNb2RpZmllcilcbiAgICAgICAgICAgIGtleS5jb25uZWN0KFwibW9kaWZpZXJzXCIsIChfLCBzdGF0ZSkgPT4gb25LZXlNb2RpZmllcih3aWRnZXQsIHN0YXRlKSlcbiAgICB9XG5cbiAgICBpZiAob25MZWdhY3kgfHwgb25CdXR0b25QcmVzc2VkIHx8IG9uQnV0dG9uUmVsZWFzZWQpIHtcbiAgICAgICAgY29uc3QgbGVnYWN5ID0gbmV3IEd0ay5FdmVudENvbnRyb2xsZXJMZWdhY3lcbiAgICAgICAgd2lkZ2V0LmFkZF9jb250cm9sbGVyKGxlZ2FjeSlcblxuICAgICAgICBsZWdhY3kuY29ubmVjdChcImV2ZW50XCIsIChfLCBldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmdldF9ldmVudF90eXBlKCkgPT09IEdkay5FdmVudFR5cGUuQlVUVE9OX1BSRVNTKSB7XG4gICAgICAgICAgICAgICAgb25CdXR0b25QcmVzc2VkPy4od2lkZ2V0LCBldmVudCBhcyBHZGsuQnV0dG9uRXZlbnQpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChldmVudC5nZXRfZXZlbnRfdHlwZSgpID09PSBHZGsuRXZlbnRUeXBlLkJVVFRPTl9SRUxFQVNFKSB7XG4gICAgICAgICAgICAgICAgb25CdXR0b25SZWxlYXNlZD8uKHdpZGdldCwgZXZlbnQgYXMgR2RrLkJ1dHRvbkV2ZW50KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvbkxlZ2FjeT8uKHdpZGdldCwgZXZlbnQpXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgaWYgKG9uTW90aW9uIHx8IG9uSG92ZXJFbnRlciB8fCBvbkhvdmVyTGVhdmUpIHtcbiAgICAgICAgY29uc3QgaG92ZXIgPSBuZXcgR3RrLkV2ZW50Q29udHJvbGxlck1vdGlvblxuICAgICAgICB3aWRnZXQuYWRkX2NvbnRyb2xsZXIoaG92ZXIpXG5cbiAgICAgICAgaWYgKG9uSG92ZXJFbnRlcilcbiAgICAgICAgICAgIGhvdmVyLmNvbm5lY3QoXCJlbnRlclwiLCAoXywgeCwgeSkgPT4gb25Ib3ZlckVudGVyKHdpZGdldCwgeCwgeSkpXG5cbiAgICAgICAgaWYgKG9uSG92ZXJMZWF2ZSlcbiAgICAgICAgICAgIGhvdmVyLmNvbm5lY3QoXCJsZWF2ZVwiLCAoKSA9PiBvbkhvdmVyTGVhdmUod2lkZ2V0KSlcblxuICAgICAgICBpZiAob25Nb3Rpb24pXG4gICAgICAgICAgICBob3Zlci5jb25uZWN0KFwibW90aW9uXCIsIChfLCB4LCB5KSA9PiBvbk1vdGlvbih3aWRnZXQsIHgsIHkpKVxuICAgIH1cblxuICAgIGlmIChvblNjcm9sbCB8fCBvblNjcm9sbERlY2VsZXJhdGUpIHtcbiAgICAgICAgY29uc3Qgc2Nyb2xsID0gbmV3IEd0ay5FdmVudENvbnRyb2xsZXJTY3JvbGxcbiAgICAgICAgc2Nyb2xsLmZsYWdzID0gR3RrLkV2ZW50Q29udHJvbGxlclNjcm9sbEZsYWdzLkJPVEhfQVhFUyB8IEd0ay5FdmVudENvbnRyb2xsZXJTY3JvbGxGbGFncy5LSU5FVElDXG4gICAgICAgIHdpZGdldC5hZGRfY29udHJvbGxlcihzY3JvbGwpXG5cbiAgICAgICAgaWYgKG9uU2Nyb2xsKVxuICAgICAgICAgICAgc2Nyb2xsLmNvbm5lY3QoXCJzY3JvbGxcIiwgKF8sIHgsIHkpID0+IG9uU2Nyb2xsKHdpZGdldCwgeCwgeSkpXG5cbiAgICAgICAgaWYgKG9uU2Nyb2xsRGVjZWxlcmF0ZSlcbiAgICAgICAgICAgIHNjcm9sbC5jb25uZWN0KFwiZGVjZWxlcmF0ZVwiLCAoXywgeCwgeSkgPT4gb25TY3JvbGxEZWNlbGVyYXRlKHdpZGdldCwgeCwgeSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHByb3BzXG59XG4iLCAiaW1wb3J0IEdMaWIgZnJvbSBcImdpOi8vR0xpYj92ZXJzaW9uPTIuMFwiXG5pbXBvcnQgR3RrIGZyb20gXCJnaTovL0d0az92ZXJzaW9uPTQuMFwiXG5pbXBvcnQgQXN0YWwgZnJvbSBcImdpOi8vQXN0YWw/dmVyc2lvbj00LjBcIlxuaW1wb3J0IHsgbWtBcHAgfSBmcm9tIFwiLi4vX2FwcFwiXG5cbkd0ay5pbml0KClcblxuLy8gc3RvcCB0aGlzIGZyb20gbGVha2luZyBpbnRvIHN1YnByb2Nlc3Nlc1xuLy8gYW5kIGdpbyBsYXVuY2ggaW52b2NhdGlvbnNcbkdMaWIudW5zZXRlbnYoXCJMRF9QUkVMT0FEXCIpXG5cbi8vIHVzZXJzIG1pZ2h0IHdhbnQgdG8gdXNlIEFkd2FpdGEgaW4gd2hpY2ggY2FzZSBpdCBoYXMgdG8gYmUgaW5pdGlhbGl6ZWRcbi8vIGl0IG1pZ2h0IGJlIGNvbW1vbiBwaXRmYWxsIHRvIGZvcmdldCBpdCBiZWNhdXNlIGBBcHBgIGlzIG5vdCBgQWR3LkFwcGxpY2F0aW9uYFxuYXdhaXQgaW1wb3J0KFwiZ2k6Ly9BZHc/dmVyc2lvbj0xXCIpXG4gICAgLnRoZW4oKHsgZGVmYXVsdDogQWR3IH0pID0+IEFkdy5pbml0KCkpXG4gICAgLmNhdGNoKCgpID0+IHZvaWQgMClcblxuZXhwb3J0IGRlZmF1bHQgbWtBcHAoQXN0YWwuQXBwbGljYXRpb24pXG4iLCAiLyoqXG4gKiBXb3JrYXJvdW5kIGZvciBcIkNhbid0IGNvbnZlcnQgbm9uLW51bGwgcG9pbnRlciB0byBKUyB2YWx1ZSBcIlxuICovXG5cbmV4cG9ydCB7IH1cblxuY29uc3Qgc25ha2VpZnkgPSAoc3RyOiBzdHJpbmcpID0+IHN0clxuICAgIC5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCBcIiQxXyQyXCIpXG4gICAgLnJlcGxhY2VBbGwoXCItXCIsIFwiX1wiKVxuICAgIC50b0xvd2VyQ2FzZSgpXG5cbmFzeW5jIGZ1bmN0aW9uIHN1cHByZXNzPFQ+KG1vZDogUHJvbWlzZTx7IGRlZmF1bHQ6IFQgfT4sIHBhdGNoOiAobTogVCkgPT4gdm9pZCkge1xuICAgIHJldHVybiBtb2QudGhlbihtID0+IHBhdGNoKG0uZGVmYXVsdCkpLmNhdGNoKCgpID0+IHZvaWQgMClcbn1cblxuZnVuY3Rpb24gcGF0Y2g8UCBleHRlbmRzIG9iamVjdD4ocHJvdG86IFAsIHByb3A6IEV4dHJhY3Q8a2V5b2YgUCwgc3RyaW5nPikge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgcHJvcCwge1xuICAgICAgICBnZXQoKSB7IHJldHVybiB0aGlzW2BnZXRfJHtzbmFrZWlmeShwcm9wKX1gXSgpIH0sXG4gICAgfSlcbn1cblxuYXdhaXQgc3VwcHJlc3MoaW1wb3J0KFwiZ2k6Ly9Bc3RhbEFwcHNcIiksICh7IEFwcHMsIEFwcGxpY2F0aW9uIH0pID0+IHtcbiAgICBwYXRjaChBcHBzLnByb3RvdHlwZSwgXCJsaXN0XCIpXG4gICAgcGF0Y2goQXBwbGljYXRpb24ucHJvdG90eXBlLCBcImtleXdvcmRzXCIpXG4gICAgcGF0Y2goQXBwbGljYXRpb24ucHJvdG90eXBlLCBcImNhdGVnb3JpZXNcIilcbn0pXG5cbmF3YWl0IHN1cHByZXNzKGltcG9ydChcImdpOi8vQXN0YWxCYXR0ZXJ5XCIpLCAoeyBVUG93ZXIgfSkgPT4ge1xuICAgIHBhdGNoKFVQb3dlci5wcm90b3R5cGUsIFwiZGV2aWNlc1wiKVxufSlcblxuYXdhaXQgc3VwcHJlc3MoaW1wb3J0KFwiZ2k6Ly9Bc3RhbEJsdWV0b290aFwiKSwgKHsgQWRhcHRlciwgQmx1ZXRvb3RoLCBEZXZpY2UgfSkgPT4ge1xuICAgIHBhdGNoKEFkYXB0ZXIucHJvdG90eXBlLCBcInV1aWRzXCIpXG4gICAgcGF0Y2goQmx1ZXRvb3RoLnByb3RvdHlwZSwgXCJhZGFwdGVyc1wiKVxuICAgIHBhdGNoKEJsdWV0b290aC5wcm90b3R5cGUsIFwiZGV2aWNlc1wiKVxuICAgIHBhdGNoKERldmljZS5wcm90b3R5cGUsIFwidXVpZHNcIilcbn0pXG5cbmF3YWl0IHN1cHByZXNzKGltcG9ydChcImdpOi8vQXN0YWxIeXBybGFuZFwiKSwgKHsgSHlwcmxhbmQsIE1vbml0b3IsIFdvcmtzcGFjZSB9KSA9PiB7XG4gICAgcGF0Y2goSHlwcmxhbmQucHJvdG90eXBlLCBcImJpbmRzXCIpXG4gICAgcGF0Y2goSHlwcmxhbmQucHJvdG90eXBlLCBcIm1vbml0b3JzXCIpXG4gICAgcGF0Y2goSHlwcmxhbmQucHJvdG90eXBlLCBcIndvcmtzcGFjZXNcIilcbiAgICBwYXRjaChIeXBybGFuZC5wcm90b3R5cGUsIFwiY2xpZW50c1wiKVxuICAgIHBhdGNoKE1vbml0b3IucHJvdG90eXBlLCBcImF2YWlsYWJsZU1vZGVzXCIpXG4gICAgcGF0Y2goTW9uaXRvci5wcm90b3R5cGUsIFwiYXZhaWxhYmxlX21vZGVzXCIpXG4gICAgcGF0Y2goV29ya3NwYWNlLnByb3RvdHlwZSwgXCJjbGllbnRzXCIpXG59KVxuXG5hd2FpdCBzdXBwcmVzcyhpbXBvcnQoXCJnaTovL0FzdGFsTXByaXNcIiksICh7IE1wcmlzLCBQbGF5ZXIgfSkgPT4ge1xuICAgIHBhdGNoKE1wcmlzLnByb3RvdHlwZSwgXCJwbGF5ZXJzXCIpXG4gICAgcGF0Y2goUGxheWVyLnByb3RvdHlwZSwgXCJzdXBwb3J0ZWRfdXJpX3NjaGVtZXNcIilcbiAgICBwYXRjaChQbGF5ZXIucHJvdG90eXBlLCBcInN1cHBvcnRlZFVyaVNjaGVtZXNcIilcbiAgICBwYXRjaChQbGF5ZXIucHJvdG90eXBlLCBcInN1cHBvcnRlZF9taW1lX3R5cGVzXCIpXG4gICAgcGF0Y2goUGxheWVyLnByb3RvdHlwZSwgXCJzdXBwb3J0ZWRNaW1lVHlwZXNcIilcbiAgICBwYXRjaChQbGF5ZXIucHJvdG90eXBlLCBcImNvbW1lbnRzXCIpXG59KVxuXG5hd2FpdCBzdXBwcmVzcyhpbXBvcnQoXCJnaTovL0FzdGFsTmV0d29ya1wiKSwgKHsgV2lmaSB9KSA9PiB7XG4gICAgcGF0Y2goV2lmaS5wcm90b3R5cGUsIFwiYWNjZXNzX3BvaW50c1wiKVxuICAgIHBhdGNoKFdpZmkucHJvdG90eXBlLCBcImFjY2Vzc1BvaW50c1wiKVxufSlcblxuYXdhaXQgc3VwcHJlc3MoaW1wb3J0KFwiZ2k6Ly9Bc3RhbE5vdGlmZFwiKSwgKHsgTm90aWZkLCBOb3RpZmljYXRpb24gfSkgPT4ge1xuICAgIHBhdGNoKE5vdGlmZC5wcm90b3R5cGUsIFwibm90aWZpY2F0aW9uc1wiKVxuICAgIHBhdGNoKE5vdGlmaWNhdGlvbi5wcm90b3R5cGUsIFwiYWN0aW9uc1wiKVxufSlcblxuYXdhaXQgc3VwcHJlc3MoaW1wb3J0KFwiZ2k6Ly9Bc3RhbFBvd2VyUHJvZmlsZXNcIiksICh7IFBvd2VyUHJvZmlsZXMgfSkgPT4ge1xuICAgIHBhdGNoKFBvd2VyUHJvZmlsZXMucHJvdG90eXBlLCBcImFjdGlvbnNcIilcbn0pXG5cbmF3YWl0IHN1cHByZXNzKGltcG9ydChcImdpOi8vQXN0YWxXcFwiKSwgKHsgV3AsIEF1ZGlvLCBWaWRlbyB9KSA9PiB7XG4gICAgcGF0Y2goV3AucHJvdG90eXBlLCBcImVuZHBvaW50c1wiKVxuICAgIHBhdGNoKFdwLnByb3RvdHlwZSwgXCJkZXZpY2VzXCIpXG4gICAgcGF0Y2goQXVkaW8ucHJvdG90eXBlLCBcInN0cmVhbXNcIilcbiAgICBwYXRjaChBdWRpby5wcm90b3R5cGUsIFwicmVjb3JkZXJzXCIpXG4gICAgcGF0Y2goQXVkaW8ucHJvdG90eXBlLCBcIm1pY3JvcGhvbmVzXCIpXG4gICAgcGF0Y2goQXVkaW8ucHJvdG90eXBlLCBcInNwZWFrZXJzXCIpXG4gICAgcGF0Y2goQXVkaW8ucHJvdG90eXBlLCBcImRldmljZXNcIilcbiAgICBwYXRjaChWaWRlby5wcm90b3R5cGUsIFwic3RyZWFtc1wiKVxuICAgIHBhdGNoKFZpZGVvLnByb3RvdHlwZSwgXCJyZWNvcmRlcnNcIilcbiAgICBwYXRjaChWaWRlby5wcm90b3R5cGUsIFwic2lua3NcIilcbiAgICBwYXRjaChWaWRlby5wcm90b3R5cGUsIFwic291cmNlc1wiKVxuICAgIHBhdGNoKFZpZGVvLnByb3RvdHlwZSwgXCJkZXZpY2VzXCIpXG59KVxuIiwgImltcG9ydCBcIi4vb3ZlcnJpZGVzLmpzXCJcbmltcG9ydCB7IHNldENvbnNvbGVMb2dEb21haW4gfSBmcm9tIFwiY29uc29sZVwiXG5pbXBvcnQgeyBleGl0LCBwcm9ncmFtQXJncyB9IGZyb20gXCJzeXN0ZW1cIlxuaW1wb3J0IElPIGZyb20gXCJnaTovL0FzdGFsSU9cIlxuaW1wb3J0IEdPYmplY3QgZnJvbSBcImdpOi8vR09iamVjdFwiXG5pbXBvcnQgR2lvIGZyb20gXCJnaTovL0dpbz92ZXJzaW9uPTIuMFwiXG5pbXBvcnQgdHlwZSBBc3RhbDMgZnJvbSBcImdpOi8vQXN0YWw/dmVyc2lvbj0zLjBcIlxuaW1wb3J0IHR5cGUgQXN0YWw0IGZyb20gXCJnaTovL0FzdGFsP3ZlcnNpb249NC4wXCJcblxudHlwZSBDb25maWcgPSBQYXJ0aWFsPHtcbiAgICBpbnN0YW5jZU5hbWU6IHN0cmluZ1xuICAgIGNzczogc3RyaW5nXG4gICAgaWNvbnM6IHN0cmluZ1xuICAgIGd0a1RoZW1lOiBzdHJpbmdcbiAgICBpY29uVGhlbWU6IHN0cmluZ1xuICAgIGN1cnNvclRoZW1lOiBzdHJpbmdcbiAgICBob2xkOiBib29sZWFuXG4gICAgcmVxdWVzdEhhbmRsZXIocmVxdWVzdDogc3RyaW5nLCByZXM6IChyZXNwb25zZTogYW55KSA9PiB2b2lkKTogdm9pZFxuICAgIG1haW4oLi4uYXJnczogc3RyaW5nW10pOiB2b2lkXG4gICAgY2xpZW50KG1lc3NhZ2U6IChtc2c6IHN0cmluZykgPT4gc3RyaW5nLCAuLi5hcmdzOiBzdHJpbmdbXSk6IHZvaWRcbn0+XG5cbmludGVyZmFjZSBBc3RhbDNKUyBleHRlbmRzIEFzdGFsMy5BcHBsaWNhdGlvbiB7XG4gICAgZXZhbChib2R5OiBzdHJpbmcpOiBQcm9taXNlPGFueT5cbiAgICByZXF1ZXN0SGFuZGxlcjogQ29uZmlnW1wicmVxdWVzdEhhbmRsZXJcIl1cbiAgICBhcHBseV9jc3Moc3R5bGU6IHN0cmluZywgcmVzZXQ/OiBib29sZWFuKTogdm9pZFxuICAgIHF1aXQoY29kZT86IG51bWJlcik6IHZvaWRcbiAgICBzdGFydChjb25maWc/OiBDb25maWcpOiB2b2lkXG59XG5cbmludGVyZmFjZSBBc3RhbDRKUyBleHRlbmRzIEFzdGFsNC5BcHBsaWNhdGlvbiB7XG4gICAgZXZhbChib2R5OiBzdHJpbmcpOiBQcm9taXNlPGFueT5cbiAgICByZXF1ZXN0SGFuZGxlcj86IENvbmZpZ1tcInJlcXVlc3RIYW5kbGVyXCJdXG4gICAgYXBwbHlfY3NzKHN0eWxlOiBzdHJpbmcsIHJlc2V0PzogYm9vbGVhbik6IHZvaWRcbiAgICBxdWl0KGNvZGU/OiBudW1iZXIpOiB2b2lkXG4gICAgc3RhcnQoY29uZmlnPzogQ29uZmlnKTogdm9pZFxufVxuXG50eXBlIEFwcDMgPSB0eXBlb2YgQXN0YWwzLkFwcGxpY2F0aW9uXG50eXBlIEFwcDQgPSB0eXBlb2YgQXN0YWw0LkFwcGxpY2F0aW9uXG5cbmV4cG9ydCBmdW5jdGlvbiBta0FwcDxBcHAgZXh0ZW5kcyBBcHAzPihBcHA6IEFwcCk6IEFzdGFsM0pTXG5leHBvcnQgZnVuY3Rpb24gbWtBcHA8QXBwIGV4dGVuZHMgQXBwND4oQXBwOiBBcHApOiBBc3RhbDRKU1xuXG5leHBvcnQgZnVuY3Rpb24gbWtBcHAoQXBwOiBBcHAzIHwgQXBwNCkge1xuICAgIHJldHVybiBuZXcgKGNsYXNzIEFzdGFsSlMgZXh0ZW5kcyBBcHAge1xuICAgICAgICBzdGF0aWMgeyBHT2JqZWN0LnJlZ2lzdGVyQ2xhc3MoeyBHVHlwZU5hbWU6IFwiQXN0YWxKU1wiIH0sIHRoaXMgYXMgYW55KSB9XG5cbiAgICAgICAgZXZhbChib2R5OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZuID0gRnVuY3Rpb24oYHJldHVybiAoYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAke2JvZHkuaW5jbHVkZXMoXCI7XCIpID8gYm9keSA6IGByZXR1cm4gJHtib2R5fTtgfVxuICAgICAgICAgICAgICAgICAgICB9KWApXG4gICAgICAgICAgICAgICAgICAgIGZuKCkoKS50aGVuKHJlcykuY2F0Y2gocmVqKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlaihlcnJvcilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdEhhbmRsZXI/OiBDb25maWdbXCJyZXF1ZXN0SGFuZGxlclwiXVxuXG4gICAgICAgIHZmdW5jX3JlcXVlc3QobXNnOiBzdHJpbmcsIGNvbm46IEdpby5Tb2NrZXRDb25uZWN0aW9uKTogdm9pZCB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMucmVxdWVzdEhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEhhbmRsZXIobXNnLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSU8ud3JpdGVfc29jayhjb25uLCBTdHJpbmcocmVzcG9uc2UpLCAoXywgcmVzKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgSU8ud3JpdGVfc29ja19maW5pc2gocmVzKSxcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN1cGVyLnZmdW5jX3JlcXVlc3QobXNnLCBjb25uKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXBwbHlfY3NzKHN0eWxlOiBzdHJpbmcsIHJlc2V0ID0gZmFsc2UpIHtcbiAgICAgICAgICAgIHN1cGVyLmFwcGx5X2NzcyhzdHlsZSwgcmVzZXQpXG4gICAgICAgIH1cblxuICAgICAgICBxdWl0KGNvZGU/OiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgICAgIHN1cGVyLnF1aXQoKVxuICAgICAgICAgICAgZXhpdChjb2RlID8/IDApXG4gICAgICAgIH1cblxuICAgICAgICBzdGFydCh7IHJlcXVlc3RIYW5kbGVyLCBjc3MsIGhvbGQsIG1haW4sIGNsaWVudCwgaWNvbnMsIC4uLmNmZyB9OiBDb25maWcgPSB7fSkge1xuICAgICAgICAgICAgY29uc3QgYXBwID0gdGhpcyBhcyB1bmtub3duIGFzIEluc3RhbmNlVHlwZTxBcHAzIHwgQXBwND5cblxuICAgICAgICAgICAgY2xpZW50ID8/PSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcHJpbnQoYEFzdGFsIGluc3RhbmNlIFwiJHthcHAuaW5zdGFuY2VOYW1lfVwiIGFscmVhZHkgcnVubmluZ2ApXG4gICAgICAgICAgICAgICAgZXhpdCgxKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMsIGNmZylcbiAgICAgICAgICAgIHNldENvbnNvbGVMb2dEb21haW4oYXBwLmluc3RhbmNlTmFtZSlcblxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGFuZGxlciA9IHJlcXVlc3RIYW5kbGVyXG4gICAgICAgICAgICBhcHAuY29ubmVjdChcImFjdGl2YXRlXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICBtYWluPy4oLi4ucHJvZ3JhbUFyZ3MpXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGFwcC5hY3F1aXJlX3NvY2tldCgpXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjbGllbnQobXNnID0+IElPLnNlbmRfcmVxdWVzdChhcHAuaW5zdGFuY2VOYW1lLCBtc2cpISwgLi4ucHJvZ3JhbUFyZ3MpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjc3MpXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseV9jc3MoY3NzLCBmYWxzZSlcblxuICAgICAgICAgICAgaWYgKGljb25zKVxuICAgICAgICAgICAgICAgIGFwcC5hZGRfaWNvbnMoaWNvbnMpXG5cbiAgICAgICAgICAgIGhvbGQgPz89IHRydWVcbiAgICAgICAgICAgIGlmIChob2xkKVxuICAgICAgICAgICAgICAgIGFwcC5ob2xkKClcblxuICAgICAgICAgICAgYXBwLnJ1bkFzeW5jKFtdKVxuICAgICAgICB9XG4gICAgfSlcbn1cbiIsICJpbXBvcnQgQXN0YWwgZnJvbSBcImdpOi8vQXN0YWw/dmVyc2lvbj00LjBcIlxuaW1wb3J0IEd0ayBmcm9tIFwiZ2k6Ly9HdGs/dmVyc2lvbj00LjBcIlxuaW1wb3J0IGFzdGFsaWZ5LCB7IHR5cGUsIHR5cGUgQ29uc3RydWN0UHJvcHMgfSBmcm9tIFwiLi9hc3RhbGlmeS5qc1wiXG5cbmZ1bmN0aW9uIGZpbHRlcihjaGlsZHJlbjogYW55W10pIHtcbiAgICByZXR1cm4gY2hpbGRyZW4uZmxhdChJbmZpbml0eSkubWFwKGNoID0+IGNoIGluc3RhbmNlb2YgR3RrLldpZGdldFxuICAgICAgICA/IGNoXG4gICAgICAgIDogbmV3IEd0ay5MYWJlbCh7IHZpc2libGU6IHRydWUsIGxhYmVsOiBTdHJpbmcoY2gpIH0pKVxufVxuXG4vLyBCb3hcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShBc3RhbC5Cb3gucHJvdG90eXBlLCBcImNoaWxkcmVuXCIsIHtcbiAgICBnZXQoKSB7IHJldHVybiB0aGlzLmdldF9jaGlsZHJlbigpIH0sXG4gICAgc2V0KHYpIHsgdGhpcy5zZXRfY2hpbGRyZW4odikgfSxcbn0pXG5cbmV4cG9ydCB0eXBlIEJveFByb3BzID0gQ29uc3RydWN0UHJvcHM8QXN0YWwuQm94LCBBc3RhbC5Cb3guQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBCb3ggPSBhc3RhbGlmeTxBc3RhbC5Cb3gsIEFzdGFsLkJveC5Db25zdHJ1Y3RvclByb3BzPihBc3RhbC5Cb3gsIHtcbiAgICBnZXRDaGlsZHJlbihzZWxmKSB7IHJldHVybiBzZWxmLmdldF9jaGlsZHJlbigpIH0sXG4gICAgc2V0Q2hpbGRyZW4oc2VsZiwgY2hpbGRyZW4pIHsgcmV0dXJuIHNlbGYuc2V0X2NoaWxkcmVuKGZpbHRlcihjaGlsZHJlbikpIH0sXG59KVxuXG4vLyBCdXR0b25cbnR5cGUgQnV0dG9uU2lnbmFscyA9IHtcbiAgICBvbkNsaWNrZWQ6IFtdXG59XG5cbmV4cG9ydCB0eXBlIEJ1dHRvblByb3BzID0gQ29uc3RydWN0UHJvcHM8R3RrLkJ1dHRvbiwgR3RrLkJ1dHRvbi5Db25zdHJ1Y3RvclByb3BzLCBCdXR0b25TaWduYWxzPlxuZXhwb3J0IGNvbnN0IEJ1dHRvbiA9IGFzdGFsaWZ5PEd0ay5CdXR0b24sIEd0ay5CdXR0b24uQ29uc3RydWN0b3JQcm9wcywgQnV0dG9uU2lnbmFscz4oR3RrLkJ1dHRvbilcblxuLy8gQ2VudGVyQm94XG5leHBvcnQgdHlwZSBDZW50ZXJCb3hQcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5DZW50ZXJCb3gsIEd0ay5DZW50ZXJCb3guQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBDZW50ZXJCb3ggPSBhc3RhbGlmeTxHdGsuQ2VudGVyQm94LCBHdGsuQ2VudGVyQm94LkNvbnN0cnVjdG9yUHJvcHM+KEd0ay5DZW50ZXJCb3gsIHtcbiAgICBnZXRDaGlsZHJlbihib3gpIHtcbiAgICAgICAgcmV0dXJuIFtib3guc3RhcnRXaWRnZXQsIGJveC5jZW50ZXJXaWRnZXQsIGJveC5lbmRXaWRnZXRdXG4gICAgfSxcbiAgICBzZXRDaGlsZHJlbihib3gsIGNoaWxkcmVuKSB7XG4gICAgICAgIGNvbnN0IGNoID0gZmlsdGVyKGNoaWxkcmVuKVxuICAgICAgICBib3guc3RhcnRXaWRnZXQgPSBjaFswXSB8fCBuZXcgR3RrLkJveFxuICAgICAgICBib3guY2VudGVyV2lkZ2V0ID0gY2hbMV0gfHwgbmV3IEd0ay5Cb3hcbiAgICAgICAgYm94LmVuZFdpZGdldCA9IGNoWzJdIHx8IG5ldyBHdGsuQm94XG4gICAgfSxcbn0pXG5cbi8vIFRPRE86IENpcmN1bGFyUHJvZ3Jlc3Ncbi8vIFRPRE86IERyYXdpbmdBcmVhXG5cbi8vIEVudHJ5XG50eXBlIEVudHJ5U2lnbmFscyA9IHtcbiAgICBvbkFjdGl2YXRlOiBbXVxuICAgIG9uTm90aWZ5VGV4dDogW11cbn1cblxuZXhwb3J0IHR5cGUgRW50cnlQcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5FbnRyeSwgR3RrLkVudHJ5LkNvbnN0cnVjdG9yUHJvcHMsIEVudHJ5U2lnbmFscz5cbmV4cG9ydCBjb25zdCBFbnRyeSA9IGFzdGFsaWZ5PEd0ay5FbnRyeSwgR3RrLkVudHJ5LkNvbnN0cnVjdG9yUHJvcHMsIEVudHJ5U2lnbmFscz4oR3RrLkVudHJ5LCB7XG4gICAgZ2V0Q2hpbGRyZW4oKSB7IHJldHVybiBbXSB9LFxufSlcblxuLy8gSW1hZ2VcbmV4cG9ydCB0eXBlIEltYWdlUHJvcHMgPSBDb25zdHJ1Y3RQcm9wczxHdGsuSW1hZ2UsIEd0ay5JbWFnZS5Db25zdHJ1Y3RvclByb3BzPlxuZXhwb3J0IGNvbnN0IEltYWdlID0gYXN0YWxpZnk8R3RrLkltYWdlLCBHdGsuSW1hZ2UuQ29uc3RydWN0b3JQcm9wcz4oR3RrLkltYWdlLCB7XG4gICAgZ2V0Q2hpbGRyZW4oKSB7IHJldHVybiBbXSB9LFxufSlcblxuLy8gTGFiZWxcbmV4cG9ydCB0eXBlIExhYmVsUHJvcHMgPSBDb25zdHJ1Y3RQcm9wczxHdGsuTGFiZWwsIEd0ay5MYWJlbC5Db25zdHJ1Y3RvclByb3BzPlxuZXhwb3J0IGNvbnN0IExhYmVsID0gYXN0YWxpZnk8R3RrLkxhYmVsLCBHdGsuTGFiZWwuQ29uc3RydWN0b3JQcm9wcz4oR3RrLkxhYmVsLCB7XG4gICAgZ2V0Q2hpbGRyZW4oKSB7IHJldHVybiBbXSB9LFxuICAgIHNldENoaWxkcmVuKHNlbGYsIGNoaWxkcmVuKSB7IHNlbGYubGFiZWwgPSBTdHJpbmcoY2hpbGRyZW4pIH0sXG59KVxuXG4vLyBMZXZlbEJhclxuZXhwb3J0IHR5cGUgTGV2ZWxCYXJQcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5MZXZlbEJhciwgR3RrLkxldmVsQmFyLkNvbnN0cnVjdG9yUHJvcHM+XG5leHBvcnQgY29uc3QgTGV2ZWxCYXIgPSBhc3RhbGlmeTxHdGsuTGV2ZWxCYXIsIEd0ay5MZXZlbEJhci5Db25zdHJ1Y3RvclByb3BzPihHdGsuTGV2ZWxCYXIsIHtcbiAgICBnZXRDaGlsZHJlbigpIHsgcmV0dXJuIFtdIH0sXG59KVxuXG4vLyBUT0RPOiBMaXN0Qm94XG5cbi8vIE92ZXJsYXlcbmV4cG9ydCB0eXBlIE92ZXJsYXlQcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5PdmVybGF5LCBHdGsuT3ZlcmxheS5Db25zdHJ1Y3RvclByb3BzPlxuZXhwb3J0IGNvbnN0IE92ZXJsYXkgPSBhc3RhbGlmeTxHdGsuT3ZlcmxheSwgR3RrLk92ZXJsYXkuQ29uc3RydWN0b3JQcm9wcz4oR3RrLk92ZXJsYXksIHtcbiAgICBnZXRDaGlsZHJlbihzZWxmKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuOiBBcnJheTxHdGsuV2lkZ2V0PiA9IFtdXG4gICAgICAgIGxldCBjaCA9IHNlbGYuZ2V0X2ZpcnN0X2NoaWxkKClcbiAgICAgICAgd2hpbGUgKGNoICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjaGlsZHJlbi5wdXNoKGNoKVxuICAgICAgICAgICAgY2ggPSBjaC5nZXRfbmV4dF9zaWJsaW5nKClcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGlsZHJlbi5maWx0ZXIoY2ggPT4gY2ggIT09IHNlbGYuY2hpbGQpXG4gICAgfSxcbiAgICBzZXRDaGlsZHJlbihzZWxmLCBjaGlsZHJlbikge1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGZpbHRlcihjaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGVzID0gdHlwZSBpbiBjaGlsZFxuICAgICAgICAgICAgICAgID8gKGNoaWxkW3R5cGVdIGFzIHN0cmluZykuc3BsaXQoL1xccysvKVxuICAgICAgICAgICAgICAgIDogW11cblxuICAgICAgICAgICAgaWYgKHR5cGVzLmluY2x1ZGVzKFwib3ZlcmxheVwiKSkge1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkX292ZXJsYXkoY2hpbGQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0X2NoaWxkKGNoaWxkKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLnNldF9tZWFzdXJlX292ZXJsYXkoY2hpbGQsIHR5cGVzLmluY2x1ZGVzKFwibWVhc3VyZVwiKSlcbiAgICAgICAgICAgIHNlbGYuc2V0X2NsaXBfb3ZlcmxheShjaGlsZCwgdHlwZXMuaW5jbHVkZXMoXCJjbGlwXCIpKVxuICAgICAgICB9XG4gICAgfSxcbn0pXG5cbi8vIFJldmVhbGVyXG5leHBvcnQgdHlwZSBSZXZlYWxlclByb3BzID0gQ29uc3RydWN0UHJvcHM8R3RrLlJldmVhbGVyLCBHdGsuUmV2ZWFsZXIuQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBSZXZlYWxlciA9IGFzdGFsaWZ5PEd0ay5SZXZlYWxlciwgR3RrLlJldmVhbGVyLkNvbnN0cnVjdG9yUHJvcHM+KEd0ay5SZXZlYWxlcilcblxuLy8gU2xpZGVyXG50eXBlIFNsaWRlclNpZ25hbHMgPSB7XG4gICAgb25DaGFuZ2VWYWx1ZTogW11cbn1cblxuZXhwb3J0IHR5cGUgU2xpZGVyUHJvcHMgPSBDb25zdHJ1Y3RQcm9wczxBc3RhbC5TbGlkZXIsIEFzdGFsLlNsaWRlci5Db25zdHJ1Y3RvclByb3BzLCBTbGlkZXJTaWduYWxzPlxuZXhwb3J0IGNvbnN0IFNsaWRlciA9IGFzdGFsaWZ5PEFzdGFsLlNsaWRlciwgQXN0YWwuU2xpZGVyLkNvbnN0cnVjdG9yUHJvcHMsIFNsaWRlclNpZ25hbHM+KEFzdGFsLlNsaWRlciwge1xuICAgIGdldENoaWxkcmVuKCkgeyByZXR1cm4gW10gfSxcbn0pXG5cbi8vIFN0YWNrXG5leHBvcnQgdHlwZSBTdGFja1Byb3BzID0gQ29uc3RydWN0UHJvcHM8R3RrLlN0YWNrLCBHdGsuU3RhY2suQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBTdGFjayA9IGFzdGFsaWZ5PEd0ay5TdGFjaywgR3RrLlN0YWNrLkNvbnN0cnVjdG9yUHJvcHM+KEd0ay5TdGFjaywge1xuICAgIHNldENoaWxkcmVuKHNlbGYsIGNoaWxkcmVuKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZmlsdGVyKGNoaWxkcmVuKSkge1xuICAgICAgICAgICAgaWYgKGNoaWxkLm5hbWUgIT0gXCJcIiAmJiBjaGlsZC5uYW1lICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZF9uYW1lZChjaGlsZCwgY2hpbGQubmFtZSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRfY2hpbGQoY2hpbGQpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxufSlcblxuLy8gU3dpdGNoXG5leHBvcnQgdHlwZSBTd2l0Y2hQcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5Td2l0Y2gsIEd0ay5Td2l0Y2guQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBTd2l0Y2ggPSBhc3RhbGlmeTxHdGsuU3dpdGNoLCBHdGsuU3dpdGNoLkNvbnN0cnVjdG9yUHJvcHM+KEd0ay5Td2l0Y2gsIHtcbiAgICBnZXRDaGlsZHJlbigpIHsgcmV0dXJuIFtdIH0sXG59KVxuXG4vLyBXaW5kb3dcbmV4cG9ydCB0eXBlIFdpbmRvd1Byb3BzID0gQ29uc3RydWN0UHJvcHM8QXN0YWwuV2luZG93LCBBc3RhbC5XaW5kb3cuQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBXaW5kb3cgPSBhc3RhbGlmeTxBc3RhbC5XaW5kb3csIEFzdGFsLldpbmRvdy5Db25zdHJ1Y3RvclByb3BzPihBc3RhbC5XaW5kb3cpXG5cbi8vIE1lbnVCdXR0b25cbmV4cG9ydCB0eXBlIE1lbnVCdXR0b25Qcm9wcyA9IENvbnN0cnVjdFByb3BzPEd0ay5NZW51QnV0dG9uLCBHdGsuTWVudUJ1dHRvbi5Db25zdHJ1Y3RvclByb3BzPlxuZXhwb3J0IGNvbnN0IE1lbnVCdXR0b24gPSBhc3RhbGlmeTxHdGsuTWVudUJ1dHRvbiwgR3RrLk1lbnVCdXR0b24uQ29uc3RydWN0b3JQcm9wcz4oR3RrLk1lbnVCdXR0b24sIHtcbiAgICBnZXRDaGlsZHJlbihzZWxmKSB7IHJldHVybiBbc2VsZi5wb3BvdmVyLCBzZWxmLmNoaWxkXSB9LFxuICAgIHNldENoaWxkcmVuKHNlbGYsIGNoaWxkcmVuKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZmlsdGVyKGNoaWxkcmVuKSkge1xuICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgR3RrLlBvcG92ZXIpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNldF9wb3BvdmVyKGNoaWxkKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNldF9jaGlsZChjaGlsZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG59KVxuXG4vLyBQb3BvcGVyXG5leHBvcnQgdHlwZSBQb3BvdmVyUHJvcHMgPSBDb25zdHJ1Y3RQcm9wczxHdGsuUG9wb3ZlciwgR3RrLlBvcG92ZXIuQ29uc3RydWN0b3JQcm9wcz5cbmV4cG9ydCBjb25zdCBQb3BvdmVyID0gYXN0YWxpZnk8R3RrLlBvcG92ZXIsIEd0ay5Qb3BvdmVyLkNvbnN0cnVjdG9yUHJvcHM+KEd0ay5Qb3BvdmVyKVxuIiwgImltcG9ydCBcIi4vb3ZlcnJpZGVzLmpzXCJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgQXN0YWxJTyB9IGZyb20gXCJnaTovL0FzdGFsSU8/dmVyc2lvbj0wLjFcIlxuZXhwb3J0ICogZnJvbSBcIi4vcHJvY2Vzcy5qc1wiXG5leHBvcnQgKiBmcm9tIFwiLi90aW1lLmpzXCJcbmV4cG9ydCAqIGZyb20gXCIuL2ZpbGUuanNcIlxuZXhwb3J0ICogZnJvbSBcIi4vZ29iamVjdC5qc1wiXG5leHBvcnQgeyBCaW5kaW5nLCBiaW5kIH0gZnJvbSBcIi4vYmluZGluZy5qc1wiXG5leHBvcnQgeyBWYXJpYWJsZSwgZGVyaXZlIH0gZnJvbSBcIi4vdmFyaWFibGUuanNcIlxuIiwgImltcG9ydCBBc3RhbCBmcm9tIFwiZ2k6Ly9Bc3RhbElPXCJcbmltcG9ydCBHaW8gZnJvbSBcImdpOi8vR2lvP3ZlcnNpb249Mi4wXCJcblxuZXhwb3J0IHsgR2lvIH1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaWxlKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIEFzdGFsLnJlYWRfZmlsZShwYXRoKSB8fCBcIlwiXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkRmlsZUFzeW5jKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgQXN0YWwucmVhZF9maWxlX2FzeW5jKHBhdGgsIChfLCByZXMpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShBc3RhbC5yZWFkX2ZpbGVfZmluaXNoKHJlcykgfHwgXCJcIilcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBBc3RhbC53cml0ZV9maWxlKHBhdGgsIGNvbnRlbnQpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpbGVBc3luYyhwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIEFzdGFsLndyaXRlX2ZpbGVfYXN5bmMocGF0aCwgY29udGVudCwgKF8sIHJlcykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKEFzdGFsLndyaXRlX2ZpbGVfZmluaXNoKHJlcykpXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9uaXRvckZpbGUoXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIGNhbGxiYWNrOiAoZmlsZTogc3RyaW5nLCBldmVudDogR2lvLkZpbGVNb25pdG9yRXZlbnQpID0+IHZvaWQsXG4pOiBHaW8uRmlsZU1vbml0b3Ige1xuICAgIHJldHVybiBBc3RhbC5tb25pdG9yX2ZpbGUocGF0aCwgKGZpbGU6IHN0cmluZywgZXZlbnQ6IEdpby5GaWxlTW9uaXRvckV2ZW50KSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKGZpbGUsIGV2ZW50KVxuICAgIH0pIVxufVxuIiwgImltcG9ydCBHT2JqZWN0IGZyb20gXCJnaTovL0dPYmplY3RcIlxuXG5leHBvcnQgeyBkZWZhdWx0IGFzIEdMaWIgfSBmcm9tIFwiZ2k6Ly9HTGliP3ZlcnNpb249Mi4wXCJcbmV4cG9ydCB7IEdPYmplY3QsIEdPYmplY3QgYXMgZGVmYXVsdCB9XG5cbmNvbnN0IG1ldGEgPSBTeW1ib2woXCJtZXRhXCIpXG5jb25zdCBwcml2ID0gU3ltYm9sKFwicHJpdlwiKVxuXG5jb25zdCB7IFBhcmFtU3BlYywgUGFyYW1GbGFncyB9ID0gR09iamVjdFxuXG5jb25zdCBrZWJhYmlmeSA9IChzdHI6IHN0cmluZykgPT4gc3RyXG4gICAgLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csIFwiJDEtJDJcIilcbiAgICAucmVwbGFjZUFsbChcIl9cIiwgXCItXCIpXG4gICAgLnRvTG93ZXJDYXNlKClcblxudHlwZSBTaWduYWxEZWNsYXJhdGlvbiA9IHtcbiAgICBmbGFncz86IEdPYmplY3QuU2lnbmFsRmxhZ3NcbiAgICBhY2N1bXVsYXRvcj86IEdPYmplY3QuQWNjdW11bGF0b3JUeXBlXG4gICAgcmV0dXJuX3R5cGU/OiBHT2JqZWN0LkdUeXBlXG4gICAgcGFyYW1fdHlwZXM/OiBBcnJheTxHT2JqZWN0LkdUeXBlPlxufVxuXG50eXBlIFByb3BlcnR5RGVjbGFyYXRpb24gPVxuICAgIHwgSW5zdGFuY2VUeXBlPHR5cGVvZiBHT2JqZWN0LlBhcmFtU3BlYz5cbiAgICB8IHsgJGd0eXBlOiBHT2JqZWN0LkdUeXBlIH1cbiAgICB8IHR5cGVvZiBTdHJpbmdcbiAgICB8IHR5cGVvZiBOdW1iZXJcbiAgICB8IHR5cGVvZiBCb29sZWFuXG4gICAgfCB0eXBlb2YgT2JqZWN0XG5cbnR5cGUgR09iamVjdENvbnN0cnVjdG9yID0ge1xuICAgIFttZXRhXT86IHtcbiAgICAgICAgUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogR09iamVjdC5QYXJhbVNwZWMgfVxuICAgICAgICBTaWduYWxzPzogeyBba2V5OiBzdHJpbmddOiBHT2JqZWN0LlNpZ25hbERlZmluaXRpb24gfVxuICAgIH1cbiAgICBuZXcoLi4uYXJnczogYW55W10pOiBhbnlcbn1cblxudHlwZSBNZXRhSW5mbyA9IEdPYmplY3QuTWV0YUluZm88bmV2ZXIsIEFycmF5PHsgJGd0eXBlOiBHT2JqZWN0LkdUeXBlIH0+LCBuZXZlcj5cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyKG9wdGlvbnM6IE1ldGFJbmZvID0ge30pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGNsczogR09iamVjdENvbnN0cnVjdG9yKSB7XG4gICAgICAgIGNvbnN0IHQgPSBvcHRpb25zLlRlbXBsYXRlXG4gICAgICAgIGlmICh0eXBlb2YgdCA9PT0gXCJzdHJpbmdcIiAmJiAhdC5zdGFydHNXaXRoKFwicmVzb3VyY2U6Ly9cIikgJiYgIXQuc3RhcnRzV2l0aChcImZpbGU6Ly9cIikpIHtcbiAgICAgICAgICAgIC8vIGFzc3VtZSB4bWwgdGVtcGxhdGVcbiAgICAgICAgICAgIG9wdGlvbnMuVGVtcGxhdGUgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodClcbiAgICAgICAgfVxuXG4gICAgICAgIEdPYmplY3QucmVnaXN0ZXJDbGFzcyh7XG4gICAgICAgICAgICBTaWduYWxzOiB7IC4uLmNsc1ttZXRhXT8uU2lnbmFscyB9LFxuICAgICAgICAgICAgUHJvcGVydGllczogeyAuLi5jbHNbbWV0YV0/LlByb3BlcnRpZXMgfSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIH0sIGNscylcblxuICAgICAgICBkZWxldGUgY2xzW21ldGFdXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvcGVydHkoZGVjbGFyYXRpb246IFByb3BlcnR5RGVjbGFyYXRpb24gPSBPYmplY3QpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldDogYW55LCBwcm9wOiBhbnksIGRlc2M/OiBQcm9wZXJ0eURlc2NyaXB0b3IpIHtcbiAgICAgICAgdGFyZ2V0LmNvbnN0cnVjdG9yW21ldGFdID8/PSB7fVxuICAgICAgICB0YXJnZXQuY29uc3RydWN0b3JbbWV0YV0uUHJvcGVydGllcyA/Pz0ge31cblxuICAgICAgICBjb25zdCBuYW1lID0ga2ViYWJpZnkocHJvcClcblxuICAgICAgICBpZiAoIWRlc2MpIHtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3AsIHtcbiAgICAgICAgICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3ByaXZdPy5bcHJvcF0gPz8gZGVmYXVsdFZhbHVlKGRlY2xhcmF0aW9uKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0KHY6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodiAhPT0gdGhpc1twcm9wXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1twcml2XSA/Pz0ge31cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbcHJpdl1bcHJvcF0gPSB2XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeShuYW1lKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGBzZXRfJHtuYW1lLnJlcGxhY2UoXCItXCIsIFwiX1wiKX1gLCB7XG4gICAgICAgICAgICAgICAgdmFsdWUodjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcHJvcF0gPSB2XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGBnZXRfJHtuYW1lLnJlcGxhY2UoXCItXCIsIFwiX1wiKX1gLCB7XG4gICAgICAgICAgICAgICAgdmFsdWUoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3Byb3BdXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIHRhcmdldC5jb25zdHJ1Y3RvclttZXRhXS5Qcm9wZXJ0aWVzW2tlYmFiaWZ5KHByb3ApXSA9IHBzcGVjKG5hbWUsIFBhcmFtRmxhZ3MuUkVBRFdSSVRFLCBkZWNsYXJhdGlvbilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBmbGFncyA9IDBcbiAgICAgICAgICAgIGlmIChkZXNjLmdldCkgZmxhZ3MgfD0gUGFyYW1GbGFncy5SRUFEQUJMRVxuICAgICAgICAgICAgaWYgKGRlc2Muc2V0KSBmbGFncyB8PSBQYXJhbUZsYWdzLldSSVRBQkxFXG5cbiAgICAgICAgICAgIHRhcmdldC5jb25zdHJ1Y3RvclttZXRhXS5Qcm9wZXJ0aWVzW2tlYmFiaWZ5KHByb3ApXSA9IHBzcGVjKG5hbWUsIGZsYWdzLCBkZWNsYXJhdGlvbilcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25hbCguLi5wYXJhbXM6IEFycmF5PHsgJGd0eXBlOiBHT2JqZWN0LkdUeXBlIH0gfCB0eXBlb2YgT2JqZWN0Pik6XG4odGFyZ2V0OiBhbnksIHNpZ25hbDogYW55LCBkZXNjPzogUHJvcGVydHlEZXNjcmlwdG9yKSA9PiB2b2lkXG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduYWwoZGVjbGFyYXRpb24/OiBTaWduYWxEZWNsYXJhdGlvbik6XG4odGFyZ2V0OiBhbnksIHNpZ25hbDogYW55LCBkZXNjPzogUHJvcGVydHlEZXNjcmlwdG9yKSA9PiB2b2lkXG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduYWwoXG4gICAgZGVjbGFyYXRpb24/OiBTaWduYWxEZWNsYXJhdGlvbiB8IHsgJGd0eXBlOiBHT2JqZWN0LkdUeXBlIH0gfCB0eXBlb2YgT2JqZWN0LFxuICAgIC4uLnBhcmFtczogQXJyYXk8eyAkZ3R5cGU6IEdPYmplY3QuR1R5cGUgfSB8IHR5cGVvZiBPYmplY3Q+XG4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldDogYW55LCBzaWduYWw6IGFueSwgZGVzYz86IFByb3BlcnR5RGVzY3JpcHRvcikge1xuICAgICAgICB0YXJnZXQuY29uc3RydWN0b3JbbWV0YV0gPz89IHt9XG4gICAgICAgIHRhcmdldC5jb25zdHJ1Y3RvclttZXRhXS5TaWduYWxzID8/PSB7fVxuXG4gICAgICAgIGNvbnN0IG5hbWUgPSBrZWJhYmlmeShzaWduYWwpXG5cbiAgICAgICAgaWYgKGRlY2xhcmF0aW9uIHx8IHBhcmFtcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIFRPRE86IHR5cGUgYXNzZXJ0XG4gICAgICAgICAgICBjb25zdCBhcnIgPSBbZGVjbGFyYXRpb24sIC4uLnBhcmFtc10ubWFwKHYgPT4gdi4kZ3R5cGUpXG4gICAgICAgICAgICB0YXJnZXQuY29uc3RydWN0b3JbbWV0YV0uU2lnbmFsc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBwYXJhbV90eXBlczogYXJyLFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LmNvbnN0cnVjdG9yW21ldGFdLlNpZ25hbHNbbmFtZV0gPSBkZWNsYXJhdGlvbiB8fCB7XG4gICAgICAgICAgICAgICAgcGFyYW1fdHlwZXM6IFtdLFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkZXNjKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBzaWduYWwsIHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gKC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChuYW1lLCAuLi5hcmdzKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb2c6ICgoLi4uYXJnczogYW55W10pID0+IHZvaWQpID0gZGVzYy52YWx1ZVxuICAgICAgICAgICAgZGVzYy52YWx1ZSA9IGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuICAgICAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3Igbm90IHR5cGVkXG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KG5hbWUsIC4uLmFyZ3MpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBgb25fJHtuYW1lLnJlcGxhY2UoXCItXCIsIFwiX1wiKX1gLCB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2cuYXBwbHkodGhpcywgYXJncylcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcHNwZWMobmFtZTogc3RyaW5nLCBmbGFnczogbnVtYmVyLCBkZWNsYXJhdGlvbjogUHJvcGVydHlEZWNsYXJhdGlvbikge1xuICAgIGlmIChkZWNsYXJhdGlvbiBpbnN0YW5jZW9mIFBhcmFtU3BlYylcbiAgICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uXG5cbiAgICBzd2l0Y2ggKGRlY2xhcmF0aW9uKSB7XG4gICAgICAgIGNhc2UgU3RyaW5nOlxuICAgICAgICAgICAgcmV0dXJuIFBhcmFtU3BlYy5zdHJpbmcobmFtZSwgXCJcIiwgXCJcIiwgZmxhZ3MsIFwiXCIpXG4gICAgICAgIGNhc2UgTnVtYmVyOlxuICAgICAgICAgICAgcmV0dXJuIFBhcmFtU3BlYy5kb3VibGUobmFtZSwgXCJcIiwgXCJcIiwgZmxhZ3MsIC1OdW1iZXIuTUFYX1ZBTFVFLCBOdW1iZXIuTUFYX1ZBTFVFLCAwKVxuICAgICAgICBjYXNlIEJvb2xlYW46XG4gICAgICAgICAgICByZXR1cm4gUGFyYW1TcGVjLmJvb2xlYW4obmFtZSwgXCJcIiwgXCJcIiwgZmxhZ3MsIGZhbHNlKVxuICAgICAgICBjYXNlIE9iamVjdDpcbiAgICAgICAgICAgIHJldHVybiBQYXJhbVNwZWMuanNvYmplY3QobmFtZSwgXCJcIiwgXCJcIiwgZmxhZ3MpXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIG1pc3N0eXBlZFxuICAgICAgICAgICAgcmV0dXJuIFBhcmFtU3BlYy5vYmplY3QobmFtZSwgXCJcIiwgXCJcIiwgZmxhZ3MsIGRlY2xhcmF0aW9uLiRndHlwZSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRWYWx1ZShkZWNsYXJhdGlvbjogUHJvcGVydHlEZWNsYXJhdGlvbikge1xuICAgIGlmIChkZWNsYXJhdGlvbiBpbnN0YW5jZW9mIFBhcmFtU3BlYylcbiAgICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uLmdldF9kZWZhdWx0X3ZhbHVlKClcblxuICAgIHN3aXRjaCAoZGVjbGFyYXRpb24pIHtcbiAgICAgICAgY2FzZSBTdHJpbmc6XG4gICAgICAgICAgICByZXR1cm4gXCJcIlxuICAgICAgICBjYXNlIE51bWJlcjpcbiAgICAgICAgICAgIHJldHVybiAwXG4gICAgICAgIGNhc2UgQm9vbGVhbjpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICBjYXNlIE9iamVjdDpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgQXN0YWwsIEd0aywgR2RrLCBXaWRnZXQgfSBmcm9tIFwiYXN0YWwvZ3RrNFwiXG5pbXBvcnQgeyBWYXJpYWJsZSwgR0xpYiB9IGZyb20gXCJhc3RhbFwiXG5pbXBvcnQgeyBleGVjQXN5bmMgfSBmcm9tIFwiYXN0YWwvcHJvY2Vzc1wiXG5pbXBvcnQgQXN0YWxBcHBzIGZyb20gXCJnaTovL0FzdGFsQXBwc1wiXG5cblxuZXhwb3J0IGZ1bmN0aW9uIFBvcHVwV2luZG93KGFyZ3M6IGFueSkge1xuICAgIGNvbnN0IHsgbmFtZSwgYW5jaG9yLCBjaGlsZCwgbWFyZ2luVG9wID0gMCwgbWFyZ2luUmlnaHQgPSAwLCBtYXJnaW5MZWZ0ID0gMCwgbWFyZ2luQm90dG9tID0gMCB9ID0gYXJncztcbiAgICBjb25zdCB7IFRPUCwgQk9UVE9NLCBMRUZULCBSSUdIVCB9ID0gQXN0YWwuV2luZG93QW5jaG9yO1xuICAgIFxuICAgIGxldCBoYWxpZ24gPSBHdGsuQWxpZ24uQ0VOVEVSO1xuICAgIGxldCB2YWxpZ24gPSBHdGsuQWxpZ24uQ0VOVEVSO1xuICAgIFxuICAgIGlmIChhbmNob3IgJiBMRUZUKSBoYWxpZ24gPSBHdGsuQWxpZ24uU1RBUlQ7XG4gICAgZWxzZSBpZiAoYW5jaG9yICYgUklHSFQpIGhhbGlnbiA9IEd0ay5BbGlnbi5FTkQ7XG4gICAgXG4gICAgaWYgKGFuY2hvciAmIFRPUCkgdmFsaWduID0gR3RrLkFsaWduLlNUQVJUO1xuICAgIGVsc2UgaWYgKGFuY2hvciAmIEJPVFRPTSkgdmFsaWduID0gR3RrLkFsaWduLkVORDtcbiAgICBcbiAgICBsZXQgY2xpY2tlZEluc2lkZSA9IGZhbHNlO1xuICAgIFxuICAgIHJldHVybiBXaWRnZXQuV2luZG93KHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgbmFtZXNwYWNlOiBuYW1lLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IFRPUCB8IEJPVFRPTSB8IExFRlQgfCBSSUdIVCxcbiAgICAgICAgZXhjbHVzaXZpdHk6IEFzdGFsLkV4Y2x1c2l2aXR5LklHTk9SRSxcbiAgICAgICAga2V5bW9kZTogQXN0YWwuS2V5bW9kZS5FWENMVVNJVkUsXG4gICAgICAgIHZpc2libGU6IGZhbHNlLFxuICAgICAgICBsYXllcjogQXN0YWwuTGF5ZXIuVE9QLFxuICAgICAgICBjaGlsZDogV2lkZ2V0Lk92ZXJsYXkoe1xuICAgICAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgIGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibW9kYWwtYmctYmFycmllclwiXSxcbiAgICAgICAgICAgICAgICBzZXR1cDogKHNlbGYpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2xpY2sgPSBuZXcgR3RrLkdlc3R1cmVDbGljaygpXG4gICAgICAgICAgICAgICAgICAgIGNsaWNrLmNvbm5lY3QoXCJyZWxlYXNlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsaWNrZWRJbnNpZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB3aW4gPSBBcHAuZ2V0X3dpbmRvdyhuYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh3aW4gJiYgd2luLnZpc2libGUpIHdpbi52aXNpYmxlID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaWNrZWRJbnNpZGUgPSBmYWxzZTsgLy8gcmVzZXRcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5hZGRfY29udHJvbGxlcihjbGljaylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHNldHVwOiAoc2VsZikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlubmVyQm94ID0gV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIGhhbGlnbixcbiAgICAgICAgICAgICAgICAgICAgdmFsaWduLFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Ub3AsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20sXG4gICAgICAgICAgICAgICAgICAgIHNldHVwOiAoaW5uZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlubmVyQ2xpY2sgPSBuZXcgR3RrLkdlc3R1cmVDbGljaygpXG4gICAgICAgICAgICAgICAgICAgICAgICBpbm5lckNsaWNrLmNvbm5lY3QoXCJwcmVzc2VkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlja2VkSW5zaWRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICBpbm5lci5hZGRfY29udHJvbGxlcihpbm5lckNsaWNrKVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBjaGlsZDogY2hpbGRcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIHNlbGYuYWRkX292ZXJsYXkoaW5uZXJCb3gpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfSk7XG59XG5cbi8vIC0tLSBSRUFDVElWRSBTVEFURSBWQVJJQUJMRVMgLS0tXG5leHBvcnQgY29uc3QgdGltZVN0YXRlID0gVmFyaWFibGUoXCIwMDowMFwiKVxuZXhwb3J0IGNvbnN0IGRhdGVTdGF0ZSA9IFZhcmlhYmxlKFwiRG9tIDEgR2VuXCIpXG5leHBvcnQgY29uc3QgdXB0aW1lU3RhdGUgPSBWYXJpYWJsZShcIjBoIDBtXCIpXG5leHBvcnQgY29uc3QgY3B1VXNhZ2UgPSBWYXJpYWJsZShcIjAlXCIpXG5leHBvcnQgY29uc3QgcmFtVXNhZ2UgPSBWYXJpYWJsZShcIjAlXCIpXG5leHBvcnQgY29uc3QgY2FmZmVpbmVTdGF0ZSA9IFZhcmlhYmxlKGZhbHNlKVxuXG5leHBvcnQgY29uc3Qgd2lmaVN0YXRlID0gVmFyaWFibGUoXCJTY2Fuc2lvbmUuLi5cIilcbmV4cG9ydCBjb25zdCBidFN0YXRlID0gVmFyaWFibGUoXCJPZmZcIilcblxuZXhwb3J0IGNvbnN0IGlzUGxheWluZyA9IFZhcmlhYmxlKGZhbHNlKVxuZXhwb3J0IGNvbnN0IG1lZGlhVHJhY2sgPSBWYXJpYWJsZShcIk5lc3N1biBtZWRpYVwiKVxuZXhwb3J0IGNvbnN0IG5pcmlXb3Jrc3BhY2VzID0gVmFyaWFibGUoXCJbXVwiKVxuXG5leHBvcnQgY29uc3Qgdm9sU3RhdGUgPSBWYXJpYWJsZShcIlZPTCBcdTIwMjIgODAlXCIpXG5leHBvcnQgY29uc3Qgdm9sVmFsID0gVmFyaWFibGUoODApLnBvbGwoMjAwMCwgKCkgPT4ge1xuICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKFwid3BjdGwgZ2V0LXZvbHVtZSBAREVGQVVMVF9BVURJT19TSU5LQCAyPi9kZXYvbnVsbFwiKVxuICAgIGlmICghb3V0KSByZXR1cm4gODBcbiAgICBpZiAob3V0LmluY2x1ZGVzKFwiW01VVEVEXVwiKSkgcmV0dXJuIDBcbiAgICBjb25zdCBtYXRjaCA9IG91dC5tYXRjaCgvVm9sdW1lOlxccysoWzAtOS5dKykvKVxuICAgIHJldHVybiBtYXRjaCA/IE1hdGgucm91bmQocGFyc2VGbG9hdChtYXRjaFsxXSkgKiAxMDApIDogODBcbn0pXG5leHBvcnQgY29uc3QgbWljVmFsID0gVmFyaWFibGUoNzApLnBvbGwoMzAwMCwgKCkgPT4ge1xuICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKFwid3BjdGwgZ2V0LXZvbHVtZSBAREVGQVVMVF9BVURJT19TT1VSQ0VAIDI+L2Rldi9udWxsXCIpXG4gICAgaWYgKCFvdXQpIHJldHVybiA3MFxuICAgIGlmIChvdXQuaW5jbHVkZXMoXCJbTVVURURdXCIpKSByZXR1cm4gMFxuICAgIGNvbnN0IG1hdGNoID0gb3V0Lm1hdGNoKC9Wb2x1bWU6XFxzKyhbMC05Ll0rKS8pXG4gICAgcmV0dXJuIG1hdGNoID8gTWF0aC5yb3VuZChwYXJzZUZsb2F0KG1hdGNoWzFdKSAqIDEwMCkgOiA3MFxufSlcbmV4cG9ydCBjb25zdCBicmlnaHRWYWwgPSBWYXJpYWJsZSg5MClcbmV4cG9ydCBjb25zdCBiYXR0U3RhdGUgPSBWYXJpYWJsZShcIlBXUiBcdTIwMjIgOTUlXCIpXG5leHBvcnQgY29uc3QgbWVkaWFBcnRpc3QgPSBWYXJpYWJsZShcIkVybWV0ZSBNZWRpYVwiKVxuZXhwb3J0IGNvbnN0IGRpc2tVc2FnZSA9IFZhcmlhYmxlKFwiNDUgR0JcIilcblxuLy8gLS0tIElOVEVSQUNUSVZFIExJU1RTICYgQVVESU8gTUlYRVIgU1RBVEUgLS0tXG5leHBvcnQgY29uc3Qgd2lmaUV4cGFuZGVkID0gVmFyaWFibGUodHJ1ZSlcbmV4cG9ydCBjb25zdCBidEV4cGFuZGVkID0gVmFyaWFibGUodHJ1ZSlcbmV4cG9ydCBjb25zdCB3aWZpTGlzdCA9IFZhcmlhYmxlPHsgc3NpZDogc3RyaW5nOyBzaWduYWw6IHN0cmluZzsgc2VjOiBzdHJpbmc7IGFjdGl2ZTogYm9vbGVhbiB9W10+KFtdKVxuZXhwb3J0IGNvbnN0IGJ0TGlzdCA9IFZhcmlhYmxlPHsgbWFjOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgY29ubmVjdGVkOiBib29sZWFuIH1bXT4oW10pXG5cbmV4cG9ydCBjb25zdCBhdWRpb1NpbmtzID0gVmFyaWFibGU8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRlc2M6IHN0cmluZzsgYWN0aXZlOiBib29sZWFuIH1bXT4oW10pXG5leHBvcnQgY29uc3QgYXVkaW9Tb3VyY2VzID0gVmFyaWFibGU8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRlc2M6IHN0cmluZzsgYWN0aXZlOiBib29sZWFuIH1bXT4oW10pXG5leHBvcnQgY29uc3QgYXBwU3RyZWFtcyA9IFZhcmlhYmxlPHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyB2b2w6IG51bWJlcjsgbXV0ZTogYm9vbGVhbiB9W10+KFtdKVxuXG5leHBvcnQgY29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpXG5leHBvcnQgZnVuY3Rpb24gZXhlY1N5bmMoY21kOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVzY2FwZWRDbWQgPSBjbWQucmVwbGFjZSgvJy9nLCBcIidcXFxcJydcIik7XG4gICAgICAgIGNvbnN0IHJlcyA9IEdMaWIuc3Bhd25fY29tbWFuZF9saW5lX3N5bmMoYHNoIC1jICcke2VzY2FwZWRDbWR9J2ApXG4gICAgICAgIGlmIChyZXNbMF0gJiYgcmVzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVjb2Rlci5kZWNvZGUocmVzWzFdKS50cmltKClcbiAgICAgICAgfVxuICAgIH0gY2F0Y2gge31cbiAgICByZXR1cm4gXCJcIlxufVxuXG4vLyAtLS0gTU9EQUwgTUFOQUdFTUVOVCAoRVhDTFVTSVZFIE9QRU4pIC0tLVxuZXhwb3J0IGNvbnN0IGFsbE1vZGFscyA9IFtcIndpZmktbW9kYWxcIiwgXCJidC1tb2RhbFwiLCBcImF1ZGlvLW1vZGFsXCIsIFwicXVpY2stc2V0dGluZ3NcIiwgXCJzeXMtbW9uaXRvclwiLCBcIm1lZGlhLXBsYXllclwiLCBcImNhbGVuZGFyXCIsIFwibGF1bmNoZXJcIiwgXCJwb3dlcm1lbnVcIiwgXCJzcG90bGlnaHRcIl1cbmV4cG9ydCBsZXQgbGFzdEZvY3VzTG9zcyA9IDBcblxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKG5hbWU6IHN0cmluZykge1xuICAgIGlmIChEYXRlLm5vdygpIC0gbGFzdEZvY3VzTG9zcyA8IDE1MCkgcmV0dXJuXG5cbiAgICBjb25zdCB3aW4gPSBBcHAuZ2V0X3dpbmRvdyhuYW1lKVxuICAgIGlmICh3aW4gJiYgd2luLnZpc2libGUpIHtcbiAgICAgICAgd2luLnZpc2libGUgPSBmYWxzZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFsbE1vZGFscy5mb3JFYWNoKG0gPT4ge1xuICAgICAgICAgICAgaWYgKG0gIT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3ID0gQXBwLmdldF93aW5kb3cobSlcbiAgICAgICAgICAgICAgICBpZiAodyAmJiB3LnZpc2libGUpIHcudmlzaWJsZSA9IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIGlmICh3aW4pIHdpbi52aXNpYmxlID0gdHJ1ZVxuICAgIH1cbn1cblxuLy8gLS0tIFNZU1RFTSBURUxFTUVUUlkgUE9MTElORyAtLS1cbi8vIE1pZ3JhdGVkIHRvIGFzeW5jIGNvbW1hbmRzIG9yIGludGVydmFscyB0byBwcmV2ZW50IEdUSyB0aHJlYWQgYmxvY2tpbmchXG5cbi8vIFRpbWUgYW5kIERhdGUgKEZhc3QgYW5kIGxpZ2h0d2VpZ2h0KVxuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIHRpbWVTdGF0ZS5zZXQoR0xpYi5EYXRlVGltZS5uZXdfbm93X2xvY2FsKCkuZm9ybWF0KFwiJUg6JU1cIikgfHwgXCIwMDowMFwiKVxufSwgMTAwMClcblxuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIGRhdGVTdGF0ZS5zZXQoR0xpYi5EYXRlVGltZS5uZXdfbm93X2xvY2FsKCkuZm9ybWF0KFwiJWEgJWQgJWJcIikgfHwgXCJcIilcbn0sIDYwMDAwKVxuXG4vLyBVcHRpbWUgKEFzeW5jIFNoZWxsKVxuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIGV4ZWNBc3luYyhcInVwdGltZSAtcFwiKS50aGVuKG91dCA9PiB1cHRpbWVTdGF0ZS5zZXQob3V0LnJlcGxhY2UoXCJ1cCBcIiwgXCJVUCBcIikgfHwgXCJVUCBBY3RpdmVcIikpLmNhdGNoKCgpID0+IHt9KVxufSwgNjAwMDApXG5cbi8vIENQVSBVc2FnZSAoQXN5bmMgU2hlbGwpXG5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJ0b3AgLWJuMSB8IGdyZXAgJ0NwdShzKScgfCBhd2sgJ3twcmludCAkMiArICQ0fSdcIl0pLnRoZW4ob3V0ID0+IHtcbiAgICAgICAgY3B1VXNhZ2Uuc2V0KGAke01hdGgucm91bmQocGFyc2VGbG9hdChvdXQpKX0lYClcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSlcbn0sIDMwMDApXG5cbi8vIFJBTSBVc2FnZSAoQXN5bmMgU2hlbGwpXG5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJmcmVlIC1tIHwgZ3JlcCBNZW0gfCBhd2sgJ3twcmludCAkM30nXCJdKS50aGVuKG91dCA9PiB7XG4gICAgICAgIGNvbnN0IGdiID0gKHBhcnNlSW50KG91dCkgLyAxMDI0KS50b0ZpeGVkKDEpXG4gICAgICAgIHJhbVVzYWdlLnNldCghaXNOYU4ocGFyc2VGbG9hdChnYikpID8gYCR7Z2J9IEdCYCA6IFwiMy4yIEdCXCIpXG4gICAgfSkuY2F0Y2goKCkgPT4ge30pXG59LCA1MDAwKVxuXG4vLyBEaXNrIFVzYWdlIChBc3luYyBTaGVsbClcbnNldEludGVydmFsKCgpID0+IHtcbiAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBcImRmIC1oIC8gfCB0YWlsIC0xIHwgYXdrICd7cHJpbnQgJDR9J1wiXSkudGhlbihvdXQgPT4ge1xuICAgICAgICBkaXNrVXNhZ2Uuc2V0KG91dCB8fCBcIjQwIEdCXCIpXG4gICAgfSkuY2F0Y2goKCkgPT4ge30pXG59LCAzMDAwMClcblxuLy8gQmF0dGVyeSAoQXN5bmMgcmVhZClcbnNldEludGVydmFsKCgpID0+IHtcbiAgICBleGVjQXN5bmMoW1wiY2F0XCIsIFwiL3N5cy9jbGFzcy9wb3dlcl9zdXBwbHkvQkFUMC9jYXBhY2l0eVwiXSkudGhlbihjYXAgPT4ge1xuICAgICAgICBleGVjQXN5bmMoW1wiY2F0XCIsIFwiL3N5cy9jbGFzcy9wb3dlcl9zdXBwbHkvQkFUMC9zdGF0dXNcIl0pLnRoZW4oc3RhdCA9PiB7XG4gICAgICAgICAgICBjb25zdCBpY29uID0gc3RhdC50cmltKCkgPT09IFwiQ2hhcmdpbmdcIiA/IFwiQ0hSXCIgOiBcIlBXUlwiXG4gICAgICAgICAgICBiYXR0U3RhdGUuc2V0KGAke2ljb259IFx1MjAyMiAke2NhcC50cmltKCl9JWApXG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGJhdHRTdGF0ZS5zZXQoYFBXUiBcdTIwMjIgJHtjYXAudHJpbSgpfSVgKSlcbiAgICB9KS5jYXRjaCgoKSA9PiBiYXR0U3RhdGUuc2V0KFwiUFdSIFx1MjAyMiBBQ1wiKSlcbn0sIDEwMDAwKVxuXG4vLyBXaS1GaSAoQXN5bmMgU2hlbGwpXG5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJubWNsaSAtdCAtZiBXSUZJIGdcIl0pLnRoZW4ob3V0ID0+IHtcbiAgICAgICAgd2lmaVN0YXRlLnNldChvdXQudHJpbSgpID09PSBcImVuYWJsZWRcIiA/IFwiV2ktRmkgXHUyMDIyIE9uXCIgOiBcIldpLUZpIFx1MjAyMiBPZmZcIilcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSlcbn0sIDcwMDApXG5cbi8vIEJsdWV0b290aCAoQXN5bmMgU2hlbGwpXG5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJyZmtpbGwgbGlzdCBibHVldG9vdGggfCBncmVwICdTb2Z0IGJsb2NrZWQ6IHllcydcIl0pLnRoZW4ob3V0ID0+IHtcbiAgICAgICAgYnRTdGF0ZS5zZXQob3V0ID8gXCJCVCBcdTIwMjIgT2ZmXCIgOiBcIkJUIFx1MjAyMiBPblwiKVxuICAgIH0pLmNhdGNoKCgpID0+IGJ0U3RhdGUuc2V0KFwiQlQgXHUyMDIyIE9uXCIpKVxufSwgODAwMClcblxuXG4vLyBOaXJpIFdvcmtzcGFjZXMgKEFzeW5jIFNoZWxsKVxuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIFwibmlyaSBtc2cgLWogd29ya3NwYWNlc1wiXSkudGhlbihvdXQgPT4ge1xuICAgICAgICBuaXJpV29ya3NwYWNlcy5zZXQob3V0LnRyaW0oKSB8fCBcIltdXCIpXG4gICAgfSkuY2F0Y2goKCkgPT4ge30pXG59LCA1MDApXG5cbi8vIFdpcmVwbHVtYmVyIChBc3RhbFdwKVxuaW1wb3J0IEFzdGFsV3AgZnJvbSBcImdpOi8vQXN0YWxXcFwiXG50cnkge1xuICAgIGNvbnN0IHdwID0gQXN0YWxXcC5nZXRfZGVmYXVsdCgpPy5hdWRpb1xuICAgIGlmICh3cCkge1xuICAgICAgICBpZiAod3AuZGVmYXVsdF9zcGVha2VyKSB7XG4gICAgICAgICAgICB3cC5kZWZhdWx0X3NwZWFrZXIuY29ubmVjdChcIm5vdGlmeTo6dm9sdW1lXCIsICgpID0+IHZvbFZhbC5zZXQoTWF0aC5yb3VuZCh3cC5kZWZhdWx0X3NwZWFrZXIudm9sdW1lICogMTAwKSkpXG4gICAgICAgICAgICB3cC5kZWZhdWx0X3NwZWFrZXIuY29ubmVjdChcIm5vdGlmeTo6bXV0ZVwiLCAoKSA9PiB2b2xWYWwuc2V0KHdwLmRlZmF1bHRfc3BlYWtlci5tdXRlID8gMCA6IE1hdGgucm91bmQod3AuZGVmYXVsdF9zcGVha2VyLnZvbHVtZSAqIDEwMCkpKVxuICAgICAgICB9XG4gICAgICAgIGlmICh3cC5kZWZhdWx0X21pY3JvcGhvbmUpIHtcbiAgICAgICAgICAgIHdwLmRlZmF1bHRfbWljcm9waG9uZS5jb25uZWN0KFwibm90aWZ5Ojp2b2x1bWVcIiwgKCkgPT4gbWljVmFsLnNldChNYXRoLnJvdW5kKHdwLmRlZmF1bHRfbWljcm9waG9uZS52b2x1bWUgKiAxMDApKSlcbiAgICAgICAgICAgIHdwLmRlZmF1bHRfbWljcm9waG9uZS5jb25uZWN0KFwibm90aWZ5OjptdXRlXCIsICgpID0+IG1pY1ZhbC5zZXQod3AuZGVmYXVsdF9taWNyb3Bob25lLm11dGUgPyAwIDogTWF0aC5yb3VuZCh3cC5kZWZhdWx0X21pY3JvcGhvbmUudm9sdW1lICogMTAwKSkpXG4gICAgICAgIH1cbiAgICB9XG59IGNhdGNoIChlKSB7XG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBcIndwY3RsIGdldC12b2x1bWUgQERFRkFVTFRfQVVESU9fU0lOS0BcIl0pLnRoZW4ob3V0ID0+IHtcbiAgICAgICAgICAgIGlmIChvdXQuaW5jbHVkZXMoXCJbTVVURURdXCIpKSB2b2xWYWwuc2V0KDApXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtID0gb3V0Lm1hdGNoKC9Wb2x1bWU6XFxzKyhbMC05Ll0rKS8pXG4gICAgICAgICAgICAgICAgaWYgKG0pIHZvbFZhbC5zZXQoTWF0aC5yb3VuZChwYXJzZUZsb2F0KG1bMV0pICogMTAwKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgIFxuICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBcIndwY3RsIGdldC12b2x1bWUgQERFRkFVTFRfQVVESU9fU09VUkNFQFwiXSkudGhlbihvdXQgPT4ge1xuICAgICAgICAgICAgaWYgKG91dC5pbmNsdWRlcyhcIltNVVRFRF1cIikpIG1pY1ZhbC5zZXQoMClcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IG0gPSBvdXQubWF0Y2goL1ZvbHVtZTpcXHMrKFswLTkuXSspLylcbiAgICAgICAgICAgICAgICBpZiAobSkgbWljVmFsLnNldChNYXRoLnJvdW5kKHBhcnNlRmxvYXQobVsxXSkgKiAxMDApKVxuICAgICAgICAgICAgfVxuICAgICAgICB9KS5jYXRjaCgoKSA9PiB7fSlcbiAgICB9LCAyMDAwKVxufVxuXG4vLyBNZWRpYSBQbGF5ZXIgKEFzdGFsTXByaXMgdmlhIGdqcylcbmltcG9ydCBBc3RhbE1wcmlzIGZyb20gXCJnaTovL0FzdGFsTXByaXNcIlxudHJ5IHtcbiAgICBjb25zdCBtcHJpcyA9IEFzdGFsTXByaXMuZ2V0X2RlZmF1bHQoKVxuICAgIGlmIChtcHJpcykge1xuICAgICAgICBjb25zdCB1cGRhdGVNZWRpYSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBsYXllcnMgPSBtcHJpcy5nZXRfcGxheWVycygpXG4gICAgICAgICAgICBpZiAocGxheWVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcCA9IHBsYXllcnNbMF1cbiAgICAgICAgICAgICAgICBtZWRpYVRyYWNrLnNldChwLnRpdGxlIHx8IFwiTmVzc3VuYSByaXByb2R1emlvbmVcIilcbiAgICAgICAgICAgICAgICBtZWRpYUFydGlzdC5zZXQocC5hcnRpc3QgfHwgXCJTY29ub3NjaXV0b1wiKVxuICAgICAgICAgICAgICAgIGlzUGxheWluZy5zZXQocC5wbGF5YmFja19zdGF0dXMgPT09IEFzdGFsTXByaXMuUGxheWJhY2tTdGF0dXMuUExBWUlORylcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVkaWFUcmFjay5zZXQoXCJOZXNzdW5hIHJpcHJvZHV6aW9uZVwiKVxuICAgICAgICAgICAgICAgIG1lZGlhQXJ0aXN0LnNldChcIlwiKVxuICAgICAgICAgICAgICAgIGlzUGxheWluZy5zZXQoZmFsc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbXByaXMuY29ubmVjdChcIm5vdGlmeTo6cGxheWVyc1wiLCB1cGRhdGVNZWRpYSlcbiAgICAgICAgLy8gQWxzbyB3ZSB3b3VsZCBuZWVkIHRvIGNvbm5lY3QgdG8gaW5kaXZpZHVhbCBwbGF5ZXIgcHJvcGVydGllcywgYnV0IGZvciBub3cgZmFsbGJhY2sgaW50ZXJ2YWwgaXMgZmluZS5cbiAgICAgICAgc2V0SW50ZXJ2YWwodXBkYXRlTWVkaWEsIDIwMDApXG4gICAgfVxufSBjYXRjaCAoZSkge1xuICAgIC8vIEZhbGxiYWNrIHRvIGFzeW5jIHBsYXllcmN0bFxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgZXhlY0FzeW5jKFtcInBsYXllcmN0bFwiLCBcIm1ldGFkYXRhXCIsIFwidGl0bGVcIl0pLnRoZW4odCA9PiBtZWRpYVRyYWNrLnNldCh0LnRyaW0oKSB8fCBcIk5lc3N1bmEgcmlwcm9kdXppb25lXCIpKS5jYXRjaCgoKSA9PiBtZWRpYVRyYWNrLnNldChcIk5lc3N1bmEgcmlwcm9kdXppb25lXCIpKVxuICAgICAgICBleGVjQXN5bmMoW1wicGxheWVyY3RsXCIsIFwibWV0YWRhdGFcIiwgXCJhcnRpc3RcIl0pLnRoZW4oYSA9PiBtZWRpYUFydGlzdC5zZXQoYS50cmltKCkpKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgZXhlY0FzeW5jKFtcInBsYXllcmN0bFwiLCBcInN0YXR1c1wiXSkudGhlbihzID0+IGlzUGxheWluZy5zZXQocy50cmltKCkgPT09IFwiUGxheWluZ1wiKSkuY2F0Y2goKCkgPT4gaXNQbGF5aW5nLnNldChmYWxzZSkpXG4gICAgfSwgMzAwMClcbn1cblxuXG4vLyAtLS0gQURWQU5DRUQgTkVUV09SSyAmIEJMVUVUT09USCBTQ0FOTklORyAtLS1cbmV4cG9ydCBmdW5jdGlvbiBzY2FuV2lmaSgpIHtcbiAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBcIm5tY2xpIC10IC1mIFNTSUQsU0lHTkFMLFNFQ1VSSVRZLElOLVVTRSBkZXYgd2lmaSBsaXN0IHwgZ3JlcCAtdiAnXjonIHwgaGVhZCAtbiA4XCJdKS50aGVuKChvdXQpID0+IHtcbiAgICAgICAgY29uc3QgbGluZXMgPSBvdXQuc3BsaXQoXCJcXG5cIikuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgIGNvbnN0IGxpc3QgPSBsaW5lcy5tYXAoKGwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gbC5zcGxpdChcIjpcIilcbiAgICAgICAgICAgIHJldHVybiB7IHNzaWQ6IHBhcnRzWzBdIHx8IFwiV2ktRmkgTmFzY29zdG9cIiwgc2lnbmFsOiBwYXJ0c1sxXSB8fCBcIjUwXCIsIHNlYzogcGFydHNbMl0gfHwgXCJPcGVuXCIsIGFjdGl2ZTogcGFydHNbM10gPT09IFwiKlwiIHx8IHBhcnRzWzNdID09PSBcInllc1wiIH1cbiAgICAgICAgfSlcbiAgICAgICAgd2lmaUxpc3Quc2V0KGxpc3QpXG4gICAgfSkuY2F0Y2goKCkgPT4ge30pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzY2FuQnQoKSB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJibHVldG9vdGhjdGwgZGV2aWNlcyB8IGhlYWQgLW4gOFwiXSkudGhlbigob3V0KSA9PiB7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gb3V0LnNwbGl0KFwiXFxuXCIpLmZpbHRlcihCb29sZWFuKVxuICAgICAgICBjb25zdCBsaXN0ID0gbGluZXMubWFwKChsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGwuc3BsaXQoXCIgXCIpXG4gICAgICAgICAgICBjb25zdCBtYWMgPSBwYXJ0c1sxXSB8fCBcIlwiXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gcGFydHMuc2xpY2UoMikuam9pbihcIiBcIikgfHwgXCJEaXNwb3NpdGl2byBCbHVldG9vdGhcIlxuICAgICAgICAgICAgY29uc3QgY29ubmVjdGVkID0gZXhlY1N5bmMoYGJsdWV0b290aGN0bCBpbmZvICR7bWFjfSB8IGdyZXAgLXEgJ0Nvbm5lY3RlZDogeWVzJyAmJiBlY2hvIHllc2ApLmluY2x1ZGVzKFwieWVzXCIpXG4gICAgICAgICAgICByZXR1cm4geyBtYWMsIG5hbWUsIGNvbm5lY3RlZCB9XG4gICAgICAgIH0pXG4gICAgICAgIGJ0TGlzdC5zZXQobGlzdClcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSlcbn1cblxuLy8gLS0tIEFEVkFOQ0VEIEFVRElPIE1JWEVSIFBPTExJTkcgLS0tXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlQXVkaW9IdWIoKSB7XG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJMQ19BTEw9QyBwYWN0bCBsaXN0IHNpbmtzIHNob3J0XCJdKS50aGVuKChvdXQpID0+IHtcbiAgICAgICAgY29uc3QgZGVmID0gZXhlY1N5bmMoXCJwYWN0bCBnZXQtZGVmYXVsdC1zaW5rIDI+L2Rldi9udWxsXCIpXG4gICAgICAgIGNvbnN0IGxpbmVzID0gb3V0LnNwbGl0KFwiXFxuXCIpLmZpbHRlcihCb29sZWFuKVxuICAgICAgICBjb25zdCBzaW5rcyA9IGxpbmVzLm1hcCgobCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsLnNwbGl0KFwiXFx0XCIpXG4gICAgICAgICAgICBjb25zdCBpZCA9IHBhcnRzWzBdXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gcGFydHNbMV1cbiAgICAgICAgICAgIGNvbnN0IGRlc2MgPSBuYW1lLnJlcGxhY2UoXCJhbHNhX291dHB1dC5cIiwgXCJcIikucmVwbGFjZShcInVzYi1cIiwgXCJcIikucmVwbGFjZShcIi5hbmFsb2ctc3RlcmVvXCIsIFwiXCIpLnJlcGxhY2UoXCIucHJvLW91dHB1dC0wXCIsIFwiXCIpLnJlcGxhY2UoXCJfXCIsIFwiIFwiKVxuICAgICAgICAgICAgcmV0dXJuIHsgaWQsIG5hbWUsIGRlc2M6IGRlc2MgfHwgbmFtZSwgYWN0aXZlOiBuYW1lID09PSBkZWYgfVxuICAgICAgICB9KVxuICAgICAgICBhdWRpb1NpbmtzLnNldChzaW5rcylcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSlcblxuICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIFwiTENfQUxMPUMgcGFjdGwgbGlzdCBzb3VyY2VzIHNob3J0IHwgZ3JlcCAtdiAnbW9uaXRvcidcIl0pLnRoZW4oKG91dCkgPT4ge1xuICAgICAgICBjb25zdCBkZWYgPSBleGVjU3luYyhcInBhY3RsIGdldC1kZWZhdWx0LXNvdXJjZSAyPi9kZXYvbnVsbFwiKVxuICAgICAgICBjb25zdCBsaW5lcyA9IG91dC5zcGxpdChcIlxcblwiKS5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IGxpbmVzLm1hcCgobCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsLnNwbGl0KFwiXFx0XCIpXG4gICAgICAgICAgICBjb25zdCBpZCA9IHBhcnRzWzBdXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gcGFydHNbMV1cbiAgICAgICAgICAgIGNvbnN0IGRlc2MgPSBuYW1lLnJlcGxhY2UoXCJhbHNhX2lucHV0LlwiLCBcIlwiKS5yZXBsYWNlKFwidXNiLVwiLCBcIlwiKS5yZXBsYWNlKFwiLmFuYWxvZy1zdGVyZW9cIiwgXCJcIikucmVwbGFjZShcIi5wcm8taW5wdXQtMFwiLCBcIlwiKS5yZXBsYWNlKFwiX1wiLCBcIiBcIilcbiAgICAgICAgICAgIHJldHVybiB7IGlkLCBuYW1lLCBkZXNjOiBkZXNjIHx8IG5hbWUsIGFjdGl2ZTogbmFtZSA9PT0gZGVmIH1cbiAgICAgICAgfSlcbiAgICAgICAgYXVkaW9Tb3VyY2VzLnNldChzb3VyY2VzKVxuICAgIH0pLmNhdGNoKCgpID0+IHt9KVxuXG4gICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJMQ19BTEw9QyBwYWN0bCBsaXN0IHNpbmstaW5wdXRzXCJdKS50aGVuKChvdXQpID0+IHtcbiAgICAgICAgY29uc3QgYmxvY2tzID0gb3V0LnNwbGl0KFwiU2luayBJbnB1dCAjXCIpLmZpbHRlcihCb29sZWFuKVxuICAgICAgICBjb25zdCBzdHJlYW1zOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgdm9sOiBudW1iZXI7IG11dGU6IGJvb2xlYW4gfVtdID0gW11cbiAgICAgICAgYmxvY2tzLmZvckVhY2goKGIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gYi5zcGxpdChcIlxcblwiKVxuICAgICAgICAgICAgY29uc3QgaWQgPSBsaW5lc1swXT8udHJpbSgpIHx8IFwiXCJcbiAgICAgICAgICAgIGxldCBuYW1lID0gYEFwcGxpY2F6aW9uZSAjJHtpZH1gXG4gICAgICAgICAgICBsZXQgdm9sID0gODBcbiAgICAgICAgICAgIGxldCBtdXRlID0gZmFsc2VcbiAgICAgICAgICAgIGxpbmVzLmZvckVhY2goKGwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAobC5pbmNsdWRlcyhcImFwcGxpY2F0aW9uLm5hbWUgPSBcIikgfHwgbC5pbmNsdWRlcyhcIm1lZGlhLm5hbWUgPSBcIikgfHwgbC5pbmNsdWRlcyhcIm5vZGUubmFtZSA9IFwiKSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lID0gbC5zcGxpdChcIj1cIilbMV0/LnJlcGxhY2UoL1wiL2csIFwiXCIpLnRyaW0oKSB8fCBuYW1lXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsLmluY2x1ZGVzKFwiVm9sdW1lOlwiKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGwubWF0Y2goLyhcXGQrKSUvKVxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHZvbCA9IHBhcnNlSW50KG1hdGNoWzFdKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobC5pbmNsdWRlcyhcIk11dGU6IHllc1wiKSkgbXV0ZSA9IHRydWVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBpZiAoaWQpIHN0cmVhbXMucHVzaCh7IGlkLCBuYW1lLCB2b2wsIG11dGUgfSlcbiAgICAgICAgfSlcbiAgICAgICAgYXBwU3RyZWFtcy5zZXQoc3RyZWFtcylcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSlcbn1cblxuLy8gUG9sbCBhdWRpbyBodWIgZXZlcnkgMyBzZWNvbmRzXG5leHBvcnQgY29uc3QgYXVkaW9UaW1lciA9IEdMaWIudGltZW91dF9hZGQoR0xpYi5QUklPUklUWV9ERUZBVUxULCAzMDAwLCAoKSA9PiB7XG4gICAgdXBkYXRlQXVkaW9IdWIoKVxuICAgIHJldHVybiBHTGliLlNPVVJDRV9DT05USU5VRVxufSlcblxuLy8gLS0tIEFQUExJQ0FUSU9OIExBVU5DSEVSIFNUQVRFIC0tLVxuZXhwb3J0IGNvbnN0IGFwcHNTZXJ2aWNlID0gbmV3IEFzdGFsQXBwcy5BcHBzKClcbmV4cG9ydCBjb25zdCBxdWVyeVZhciA9IFZhcmlhYmxlKFwiXCIpXG5leHBvcnQgY29uc3QgYWN0aXZlQ2F0ZWdvcnkgPSBWYXJpYWJsZShcIlR1dHRpXCIpXG5leHBvcnQgY29uc3QgbGlzdGJveCA9IG5ldyBHdGsuTGlzdEJveCh7IGNzc19jbGFzc2VzOiBbXCJsYXVuY2hlci1saXN0XCJdIH0pXG5cbmV4cG9ydCBjb25zdCBDQVRFR09SWV9NQVA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICBcIlx1RDgzQ1x1REYxMCBJbnRlcm5ldFwiOiBbXCJOZXR3b3JrXCIsIFwiV2ViQnJvd3NlclwiLCBcIkVtYWlsXCJdLFxuICAgIFwiXHVEODNDXHVERkE4IE11bHRpbWVkaWFcIjogW1wiQXVkaW9cIiwgXCJWaWRlb1wiLCBcIkF1ZGlvVmlkZW9cIiwgXCJHcmFwaGljc1wiXSxcbiAgICBcIlx1RDgzRFx1REVFMFx1RkUwRiBTaXN0ZW1hXCI6IFtcIlN5c3RlbVwiLCBcIlNldHRpbmdzXCIsIFwiRW11bGF0b3JcIl0sXG4gICAgXCJcdUQ4M0VcdURERjAgVXRpbGl0XHUwMEUwXCI6IFtcIlV0aWxpdHlcIiwgXCJUZXh0RWRpdG9yXCIsIFwiRGV2ZWxvcG1lbnRcIl0sXG4gICAgXCJcdUQ4M0RcdURDQkMgVWZmaWNpb1wiOiBbXCJPZmZpY2VcIl0sXG4gICAgXCJcdUQ4M0NcdURGQUUgR2lvY2hpXCI6IFtcIkdhbWVcIl1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZUFwcExpc3QoKSB7XG4gICAgbGV0IGNoaWxkID0gbGlzdGJveC5nZXRfZmlyc3RfY2hpbGQoKVxuICAgIHdoaWxlIChjaGlsZCkge1xuICAgICAgICBjb25zdCBuZXh0ID0gY2hpbGQuZ2V0X25leHRfc2libGluZygpXG4gICAgICAgIGxpc3Rib3gucmVtb3ZlKGNoaWxkKVxuICAgICAgICBjaGlsZCA9IG5leHRcbiAgICB9XG4gICAgXG4gICAgbGV0IGFwcHMgPSBhcHBzU2VydmljZS5nZXRfbGlzdCgpXG4gICAgY29uc3QgcSA9IHF1ZXJ5VmFyLmdldCgpXG4gICAgY29uc3QgY2F0ID0gYWN0aXZlQ2F0ZWdvcnkuZ2V0KClcbiAgICBcbiAgICBpZiAocSkge1xuICAgICAgICBhcHBzID0gYXBwc1NlcnZpY2UuZnV6enlfcXVlcnkocSlcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY2F0ICE9PSBcIlR1dHRpXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRDYXRzID0gQ0FURUdPUllfTUFQW2NhdF0gfHwgW11cbiAgICAgICAgICAgIGFwcHMgPSBhcHBzLmZpbHRlcihhcHAgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghYXBwLmNhdGVnb3JpZXMpIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiBhcHAuY2F0ZWdvcmllcy5zb21lKGMgPT4gYWxsb3dlZENhdHMuaW5jbHVkZXMoYykpXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGFwcHMuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSlcbiAgICB9XG4gICAgXG4gICAgYXBwcyA9IGFwcHMuc2xpY2UoMCwgNDApXG4gICAgXG4gICAgaWYgKGFwcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGxpc3Rib3guYXBwZW5kKFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIk5lc3N1bmEgYXBwbGljYXppb25lIHRyb3ZhdGFcIiwgY3NzX2NsYXNzZXM6IFtcImxhdW5jaGVyLWVtcHR5XCJdIH0pKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGFwcHMuZm9yRWFjaCgoYXBwKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByb3cgPSBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiYXBwLWNhcmRcIl0sXG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgIHNwYWNpbmc6IDE0LFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5JbWFnZSh7IGljb25fbmFtZTogYXBwLmljb25fbmFtZSB8fCBcImFwcGxpY2F0aW9uLXgtZXhlY3V0YWJsZVwiLCBwaXhlbF9zaXplOiAzNiwgY3NzX2NsYXNzZXM6IFtcImFwcC1pY29uXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBhcHAubmFtZSwgeGFsaWduOiAwLCBjc3NfY2xhc3NlczogW1wiYXBwLW5hbWVcIl0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGFwcC5kZXNjcmlwdGlvbiB8fCBcIkFwcGxpY2F6aW9uZSBFcm1ldGUgT1NcIiwgeGFsaWduOiAwLCBjc3NfY2xhc3NlczogW1wiYXBwLWRlc2NcIl0gfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgY29uc3QgZ2VzdHVyZSA9IG5ldyBHdGsuR2VzdHVyZUNsaWNrKClcbiAgICAgICAgICAgIGdlc3R1cmUuY29ubmVjdChcInJlbGVhc2VkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICBhcHAubGF1bmNoKClcbiAgICAgICAgICAgICAgICB0b2dnbGVFeGNsdXNpdmVNb2RhbChcImxhdW5jaGVyXCIpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgcm93LmFkZF9jb250cm9sbGVyKGdlc3R1cmUpXG4gICAgICAgICAgICBsaXN0Ym94LmFwcGVuZChyb3cpXG4gICAgICAgIH0pXG4gICAgfVxufVxuXG5cbi8vIC0tLSBTWVNUUkFZIENPTVBPTkVOVCAtLS1cbmltcG9ydCBBc3RhbFRyYXkgZnJvbSBcImdpOi8vQXN0YWxUcmF5XCJcbmltcG9ydCB7IGJpbmQgfSBmcm9tIFwiYXN0YWxcIlxuXG5leHBvcnQgZnVuY3Rpb24gU3lzVHJheSgpIHtcbiAgICBjb25zdCB0cmF5ID0gQXN0YWxUcmF5LmdldF9kZWZhdWx0KClcblxuICAgIHJldHVybiBXaWRnZXQuQm94KHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcImJhci1waWxsXCIsIFwic3lzdHJheS1ib3hcIl0sXG4gICAgICAgIHNwYWNpbmc6IDgsXG4gICAgICAgIHZpc2libGU6IGJpbmQodHJheSwgXCJpdGVtc1wiKS5hcyhpdGVtcyA9PiBpdGVtcy5sZW5ndGggPiAwKSxcbiAgICAgICAgY2hpbGRyZW46IGJpbmQodHJheSwgXCJpdGVtc1wiKS5hcyhpdGVtcyA9PlxuICAgICAgICAgICAgaXRlbXMubWFwKGl0ZW0gPT4gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInRyYXktaXRlbS1idG5cIl0sXG4gICAgICAgICAgICAgICAgdG9vbHRpcF9tYXJrdXA6IGJpbmQoaXRlbSwgXCJ0b29sdGlwX21hcmt1cFwiKSxcbiAgICAgICAgICAgICAgICBjaGlsZDogV2lkZ2V0LkltYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgZ2ljb246IGJpbmQoaXRlbSwgXCJnaWNvblwiKSxcbiAgICAgICAgICAgICAgICAgICAgcGl4ZWxfc2l6ZTogMTZcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IGl0ZW0uYWN0aXZhdGUoMCwgMCksXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgKVxuICAgIH0pXG59XG5cbiIsICJpbXBvcnQgeyBBcHAsIEFzdGFsLCBHdGssIEdkaywgV2lkZ2V0IH0gZnJvbSBcImFzdGFsL2d0azRcIlxuaW1wb3J0IHsgVmFyaWFibGUsIEdMaWIgfSBmcm9tIFwiYXN0YWxcIlxuaW1wb3J0IHsgZXhlY0FzeW5jIH0gZnJvbSBcImFzdGFsL3Byb2Nlc3NcIlxuaW1wb3J0IHsgYmluZCB9IGZyb20gXCJhc3RhbFwiXG5pbXBvcnQgQXN0YWxBcHBzIGZyb20gXCJnaTovL0FzdGFsQXBwc1wiXG5pbXBvcnQgQXN0YWxUcmF5IGZyb20gXCJnaTovL0FzdGFsVHJheVwiXG5pbXBvcnQgQXN0YWxXcCBmcm9tIFwiZ2k6Ly9Bc3RhbFdwXCJcbmltcG9ydCBBc3RhbE1wcmlzIGZyb20gXCJnaTovL0FzdGFsTXByaXNcIlxuaW1wb3J0IHsgUG9wdXBXaW5kb3csIHRpbWVTdGF0ZSwgZGF0ZVN0YXRlLCB1cHRpbWVTdGF0ZSwgY3B1VXNhZ2UsIHJhbVVzYWdlLCBjYWZmZWluZVN0YXRlLCB3aWZpU3RhdGUsIGJ0U3RhdGUsIGlzUGxheWluZywgbWVkaWFUcmFjaywgbmlyaVdvcmtzcGFjZXMsIHZvbFN0YXRlLCB2b2xWYWwsIG1pY1ZhbCwgYnJpZ2h0VmFsLCBiYXR0U3RhdGUsIG1lZGlhQXJ0aXN0LCBkaXNrVXNhZ2UsIHdpZmlFeHBhbmRlZCwgYnRFeHBhbmRlZCwgd2lmaUxpc3QsIGJ0TGlzdCwgYXVkaW9TaW5rcywgYXVkaW9Tb3VyY2VzLCBhcHBTdHJlYW1zLCBkZWNvZGVyLCBleGVjU3luYywgYWxsTW9kYWxzLCBsYXN0Rm9jdXNMb3NzLCB0b2dnbGVFeGNsdXNpdmVNb2RhbCwgc2NhbldpZmksIHNjYW5CdCwgdXBkYXRlQXVkaW9IdWIsIGF1ZGlvVGltZXIsIGFwcHNTZXJ2aWNlLCBxdWVyeVZhciwgYWN0aXZlQ2F0ZWdvcnksIGxpc3Rib3gsIENBVEVHT1JZX01BUCwgdXBkYXRlQXBwTGlzdCwgU3lzVHJheSB9IGZyb20gXCIuL3N0YXRlXCJcbmltcG9ydCB7IEZpcmV3YWxsVG9nZ2xlIH0gZnJvbSBcIi4vZmlyZXdhbGxcIlxuaW1wb3J0IHsgVXBkYXRlckJ1dHRvbiB9IGZyb20gXCIuL3VwZGF0ZXJcIlxuXG4vLyAtLS0gMS4gVE9QIEJBUiBDT01QT05FTlQgLS0tXG5leHBvcnQgZnVuY3Rpb24gTmlyaVdvcmtzcGFjZXMoY29ubmVjdG9yOiBzdHJpbmcpIHtcbiAgICBjb25zdCBidG5zOiBhbnlbXSA9IFtdO1xuICAgIGxldCB3c1JlZnM6IGFueVtdID0gW107XG4gICAgXG4gICAgZm9yKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgYnRucy5wdXNoKFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndvcmtzcGFjZS1idG5cIl0sXG4gICAgICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh3c1JlZnNbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWYgPSB3c1JlZnNbaV07XG4gICAgICAgICAgICAgICAgICAgIEdMaWIuc3Bhd25fY29tbWFuZF9saW5lX2FzeW5jKGBuaXJpIG1zZyBhY3Rpb24gZm9jdXMtd29ya3NwYWNlICR7cmVmfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkpXG4gICAgfVxuICAgIFxuICAgIG5pcmlXb3Jrc3BhY2VzLnN1YnNjcmliZShqc29uID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCB3c3MgPSBKU09OLnBhcnNlKGpzb24pO1xuICAgICAgICAgICAgaWYgKGNvbm5lY3Rvcikge1xuICAgICAgICAgICAgICAgIHdzcyA9IHdzcy5maWx0ZXIoKHc6IGFueSkgPT4gdy5vdXRwdXQgPT09IGNvbm5lY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3c3Muc29ydCgoYTogYW55LCBiOiBhbnkpID0+IGEuaWR4IC0gYi5pZHgpO1xuICAgICAgICAgICAgZm9yKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidG4gPSBidG5zW2ldO1xuICAgICAgICAgICAgICAgIGlmIChpIDwgd3NzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB3cyA9IHdzc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgd3NSZWZzW2ldID0gd3MubmFtZSA/IHdzLm5hbWUgOiB3cy5pZHg7XG4gICAgICAgICAgICAgICAgICAgIGJ0bi5sYWJlbCA9IHdzLm5hbWUgPyB3cy5uYW1lIDogYCR7d3MuaWR4fWA7XG4gICAgICAgICAgICAgICAgICAgIGlmICh3cy5pc19mb2N1c2VkKSBidG4uY3NzX2NsYXNzZXMgPSBbXCJ3b3Jrc3BhY2UtYnRuXCIsIFwiZm9jdXNlZFwiXTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAod3MuaXNfYWN0aXZlKSBidG4uY3NzX2NsYXNzZXMgPSBbXCJ3b3Jrc3BhY2UtYnRuXCIsIFwiYWN0aXZlXCJdO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGJ0bi5jc3NfY2xhc3NlcyA9IFtcIndvcmtzcGFjZS1idG5cIl07XG4gICAgICAgICAgICAgICAgICAgIGJ0bi52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB3c1JlZnNbaV0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIGJ0bi52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHt9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gV2lkZ2V0LkJveCh7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJiYXItcGlsbFwiLCBcIndvcmtzcGFjZS1jb250YWluZXJcIl0sXG4gICAgICAgIHNwYWNpbmc6IDIsXG4gICAgICAgIHNldHVwOiAoc2VsZikgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsID0gbmV3IEd0ay5FdmVudENvbnRyb2xsZXJTY3JvbGwoe1xuICAgICAgICAgICAgICAgIGZsYWdzOiBHdGsuRXZlbnRDb250cm9sbGVyU2Nyb2xsRmxhZ3MuVkVSVElDQUwgfCBHdGsuRXZlbnRDb250cm9sbGVyU2Nyb2xsRmxhZ3MuRElTQ1JFVEVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBzY3JvbGwuY29ubmVjdChcInNjcm9sbFwiLCAoY3RybCwgZHgsIGR5KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGR5ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBHTGliLnNwYXduX2NvbW1hbmRfbGluZV9hc3luYyhcIm5pcmkgbXNnIGFjdGlvbiBmb2N1cy13b3Jrc3BhY2UtZG93blwiKVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZHkgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIEdMaWIuc3Bhd25fY29tbWFuZF9saW5lX2FzeW5jKFwibmlyaSBtc2cgYWN0aW9uIGZvY3VzLXdvcmtzcGFjZS11cFwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHNlbGYuYWRkX2NvbnRyb2xsZXIoc2Nyb2xsKVxuICAgICAgICB9LFxuICAgICAgICBjaGlsZHJlbjogYnRuc1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gVG9wQmFyKG1vbml0b3I6IEdkay5Nb25pdG9yLCBpZHg6IG51bWJlcikge1xuICAgIGNvbnN0IHsgVE9QLCBMRUZULCBSSUdIVCB9ID0gQXN0YWwuV2luZG93QW5jaG9yXG5cbiAgICBjb25zdCBsZWZ0SXNsYW5kID0gV2lkZ2V0LkJveCh7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJiYXItcGlsbFwiXSxcbiAgICAgICAgc3BhY2luZzogOCxcbiAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIm9zLWxvZ28tYnRuXCJdLFxuICAgICAgICAgICAgICAgIGxhYmVsOiBcIlx1MjVDOCBFcm1ldGVcIixcbiAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwibGF1bmNoZXJcIilcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImNhZmZlaW5lLWluZGljYXRvclwiXSxcbiAgICAgICAgICAgICAgICBsYWJlbDogY2FmZmVpbmVTdGF0ZSgpLmFzKGMgPT4gYyA/IFwiXHUyNjY4IEF3YWtlXCIgOiBcIlwiKSxcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiBjYWZmZWluZVN0YXRlKCkuYXMoYyA9PiBjKSxcbiAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IGNhZmZlaW5lU3RhdGUuc2V0KGZhbHNlKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICBjb25zdCBjZW50ZXJMZWZ0SXNsYW5kID0gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJiYXItcGlsbFwiLCBcInN5c21vbi1waWxsLWJ0blwiXSxcbiAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwic3lzLW1vbml0b3JcIiksXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIHNwYWNpbmc6IDYsXG4gICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBjcHVVc2FnZSgpLmFzKGMgPT4gYENQVSAke2N9YCkgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyMDIyXCIsIGNzc19jbGFzc2VzOiBbXCJ3b3Jrc3BhY2UtaW5kaWNhdG9yXCJdIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiByYW1Vc2FnZSgpLmFzKHIgPT4gYFJBTSAke3J9YCkgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxuXG4gICAgY29uc3QgY2VudGVySXNsYW5kID0gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJiYXItcGlsbFwiLCBcIm1lZGlhLXBpbGwtYnRuXCJdLFxuICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJtZWRpYS1wbGF5ZXJcIiksXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIHNwYWNpbmc6IDYsXG4gICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBpc1BsYXlpbmcoKS5hcyhwID0+IHAgPyBcIlx1MjVCNlwiIDogXCJcdTI2NkJcIikgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IG1lZGlhVHJhY2soKS5hcyh0ID0+IHQubGVuZ3RoID4gMjggPyB0LnN1YnN0cmluZygwLCAyNikgKyBcIlx1MjAyNlwiIDogdCkgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxuXG4gICAgY29uc3QgY2VudGVyUmlnaHRJc2xhbmQgPSBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcImJhci1waWxsXCIsIFwiY2xvY2stYnRuXCJdLFxuICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJjYWxlbmRhclwiKSxcbiAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgc3BhY2luZzogNixcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IHRpbWVTdGF0ZSgpIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1MjAyMlwiLCBjc3NfY2xhc3NlczogW1wid29ya3NwYWNlLWluZGljYXRvclwiXSB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogZGF0ZVN0YXRlKCkgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxuXG4gICAgLy8gTU9EVUxBUiBJTkRJVklEVUFMIEJVVFRPTlMgRk9SIEVBQ0ggU0VDVElPTlxuICAgIGNvbnN0IHJpZ2h0SXNsYW5kID0gV2lkZ2V0LkJveCh7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJiYXItcGlsbFwiXSxcbiAgICAgICAgc3BhY2luZzogNixcbiAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgU3lzVHJheSgpLFxuICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInN0YXR1cy1waWxsLWJ0blwiXSxcbiAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHsgc2NhbldpZmkoKTsgdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJ3aWZpLW1vZGFsXCIpIH0sXG4gICAgICAgICAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiA2LFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHVGMUVCXCIsIGNzc19jbGFzc2VzOiBbXCJzdGF0dXMtaWNvblwiLCBcIndpZmlcIl0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogd2lmaVN0YXRlKCkuYXModyA9PiB3LmluY2x1ZGVzKFwiT25cIikgPyBcIldpLUZpXCIgOiBcIk9mZlwiKSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyMDIyXCIsIGNzc19jbGFzc2VzOiBbXCJ3b3Jrc3BhY2UtaW5kaWNhdG9yXCJdIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInN0YXR1cy1waWxsLWJ0blwiXSxcbiAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHsgc2NhbkJ0KCk7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwiYnQtbW9kYWxcIikgfSxcbiAgICAgICAgICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDYsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdUYyOTRcIiwgY3NzX2NsYXNzZXM6IFtcInN0YXR1cy1pY29uXCIsIFwiYnRcIl0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogYnRTdGF0ZSgpLmFzKGIgPT4gYi5pbmNsdWRlcyhcIk9uXCIpID8gXCJCVFwiIDogXCJPZmZcIikgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1MjAyMlwiLCBjc3NfY2xhc3NlczogW1wid29ya3NwYWNlLWluZGljYXRvclwiXSB9KSxcbiAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJzdGF0dXMtcGlsbC1idG5cIl0sXG4gICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7IHVwZGF0ZUF1ZGlvSHViKCk7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwiYXVkaW8tbW9kYWxcIikgfSxcbiAgICAgICAgICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDYsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdTI2NkJcIiwgY3NzX2NsYXNzZXM6IFtcInN0YXR1cy1pY29uXCIsIFwidm9sXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IHZvbFZhbCgpLmFzKHYgPT4gdiA9PT0gMCA/IFwiTXV0b1wiIDogYCR7dn0lYCkgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1MjAyMlwiLCBjc3NfY2xhc3NlczogW1wid29ya3NwYWNlLWluZGljYXRvclwiXSB9KSxcbiAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJzdGF0dXMtcGlsbC1idG5cIl0sXG4gICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB0b2dnbGVFeGNsdXNpdmVNb2RhbChcInF1aWNrLXNldHRpbmdzXCIpLFxuICAgICAgICAgICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogNixcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1RjI0MFwiLCBjc3NfY2xhc3NlczogW1wic3RhdHVzLWljb25cIiwgXCJiYXR0XCJdLCB2aXNpYmxlOiBiYXR0U3RhdGUoKS5hcyhiID0+ICFiLmluY2x1ZGVzKFwiQUNcIikpIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGJhdHRTdGF0ZSgpLmFzKGIgPT4gYi5yZXBsYWNlKFwiUFdSIFx1MjAyMiBcIiwgXCJcIikpLCB2aXNpYmxlOiBiYXR0U3RhdGUoKS5hcyhiID0+ICFiLmluY2x1ZGVzKFwiQUNcIikpIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyNzU2IENvbmZpZ1wiLCBjc3NfY2xhc3NlczogW1wic3RhdHVzLWljb25cIiwgXCJnZWFyXCJdIH0pXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wicG93ZXItYnRuXCJdLFxuICAgICAgICAgICAgICAgIGxhYmVsOiBcIlx1MjNGQlwiLFxuICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJwb3dlcm1lbnVcIilcbiAgICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAgcmV0dXJuIFdpZGdldC5XaW5kb3coe1xuICAgICAgICBuYW1lOiBgYmFyLSR7aWR4fWAsXG4gICAgICAgIG5hbWVzcGFjZTogXCJiYXJcIixcbiAgICAgICAgYXBwbGljYXRpb246IEFwcCxcbiAgICAgICAgZ2RrbW9uaXRvcjogbW9uaXRvcixcbiAgICAgICAgYW5jaG9yOiBUT1AgfCBMRUZUIHwgUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5FWENMVVNJVkUsXG4gICAgICAgIGhlaWdodFJlcXVlc3Q6IDI4LFxuICAgICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkNlbnRlckJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1widG9wLWJhclwiXSxcbiAgICAgICAgICAgIHNldHVwOiAoc2VsZikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjcm9sbCA9IG5ldyBHdGsuRXZlbnRDb250cm9sbGVyU2Nyb2xsKHtcbiAgICAgICAgICAgICAgICAgICAgZmxhZ3M6IEd0ay5FdmVudENvbnRyb2xsZXJTY3JvbGxGbGFncy5WRVJUSUNBTCB8IEd0ay5FdmVudENvbnRyb2xsZXJTY3JvbGxGbGFncy5ESVNDUkVURVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgc2Nyb2xsLmNvbm5lY3QoXCJzY3JvbGxcIiwgKGN0cmwsIGR4LCBkeSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBHTGliLnNwYXduX2NvbW1hbmRfbGluZV9hc3luYyhcIm5pcmkgbXNnIGFjdGlvbiBmb2N1cy1jb2x1bW4tcmlnaHRcIilcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkeSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEdMaWIuc3Bhd25fY29tbWFuZF9saW5lX2FzeW5jKFwibmlyaSBtc2cgYWN0aW9uIGZvY3VzLWNvbHVtbi1sZWZ0XCIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIHNlbGYuYWRkX2NvbnRyb2xsZXIoc2Nyb2xsKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXJ0V2lkZ2V0OiBXaWRnZXQuQm94KHsgc3BhY2luZzogOCwgY2hpbGRyZW46IFtsZWZ0SXNsYW5kLCBOaXJpV29ya3NwYWNlcyhtb25pdG9yLmdldF9jb25uZWN0b3IoKSB8fCBcIlwiKV0gfSksXG4gICAgICAgICAgICBjZW50ZXJXaWRnZXQ6IFdpZGdldC5Cb3goeyBzcGFjaW5nOiA4LCBjaGlsZHJlbjogW2NlbnRlcklzbGFuZCwgY2VudGVyUmlnaHRJc2xhbmRdIH0pLFxuICAgICAgICAgICAgZW5kV2lkZ2V0OiBXaWRnZXQuQm94KHsgaGFsaWduOiBHdGsuQWxpZ24uRU5ELCBzcGFjaW5nOiA4LCBjaGlsZHJlbjogW2NlbnRlckxlZnRJc2xhbmQsIHJpZ2h0SXNsYW5kXSB9KVxuICAgICAgICB9KVxuICAgIH0pXG59XG5cbi8vIC0tLSAyQS4gREVESUNBVEVEIFdJLUZJIE1PREFMIC0tLVxuZXhwb3J0IGZ1bmN0aW9uIFdpZmlNb2RhbCgpIHtcbiAgICBjb25zdCB7IFRPUCwgUklHSFQgfSA9IEFzdGFsLldpbmRvd0FuY2hvclxuXG4gICAgcmV0dXJuIFBvcHVwV2luZG93KHtcbiAgICAgICAgbmFtZTogXCJ3aWZpLW1vZGFsXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJ3aWZpLW1vZGFsXCIsXG4gICAgICAgIGFwcGxpY2F0aW9uOiBBcHAsXG4gICAgICAgIGFuY2hvcjogVE9QIHwgUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgbWFyZ2luVG9wOiA0MCxcbiAgICAgICAgbWFyZ2luUmlnaHQ6IDE1MCxcbiAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImZvY3VzZWQtbW9kYWwtYm94XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDE0LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHVGMUVCICBDb25uZXNzaW9uZSBXaS1GaVwiLCBjc3NfY2xhc3NlczogW1wiZG9uZ2xlLXRpdGxlXCJdLCBoZXhwYW5kOiB0cnVlLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgbGFiZWw6IFwiXHUyNzE1XCIsIGNzc19jbGFzc2VzOiBbXCJkb25nbGUtY2xvc2UtYnRuXCJdLCBvbkNsaWNrZWQ6ICgpID0+IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwid2lmaS1tb2RhbFwiKSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiB3aWZpU3RhdGUoKS5hcyh3ID0+IHcuaW5jbHVkZXMoXCJPblwiKSA/IFtcInF1aWNrLXRvZ2dsZS1idG5cIiwgXCJ3aWZpXCIsIFwiYWN0aXZlXCJdIDogW1wicXVpY2stdG9nZ2xlLWJ0blwiLCBcIndpZmlcIl0pLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogd2lmaVN0YXRlKCkuYXModyA9PiB3LmluY2x1ZGVzKFwiT25cIikgPyBcIlx1MjcxNCBXaS1GaSBBdHRpdm8gXHUyMDIyIENsaWNjYSBwZXIgRGlzYXR0aXZhcmVcIiA6IFwiXHUyNzE1IFdpLUZpIERpc2F0dGl2YXRvIFx1MjAyMiBDbGljY2EgcGVyIEF0dGl2YXJlXCIpLFxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIFwibm1jbGkgcmFkaW8gd2lmaSB8IGdyZXAgLXEgJ2VuYWJsZWQnICYmIG5tY2xpIHJhZGlvIHdpZmkgb2ZmIHx8IG5tY2xpIHJhZGlvIHdpZmkgb25cIl0pLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgd2lmaVN0YXRlLnNldCh3aWZpU3RhdGUuZ2V0KCkuaW5jbHVkZXMoXCJPblwiKSA/IFwiV2ktRmkgXHUyMDIyIE9mZlwiIDogXCJXaS1GaSBcdTIwMjIgT25cIilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wic3ViLWxpc3QtYm94XCJdLFxuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiA2LFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogd2lmaUxpc3QoKS5hcygobGlzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSByZXR1cm4gW1dpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlNjYW5zaW9uZSByZXRpIFdpLUZpIGluIGNvcnNvLi4uXCIsIGNzc19jbGFzc2VzOiBbXCJzdWItbGlzdC1sYWJlbFwiXSB9KV1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0Lm1hcCgobmV0KSA9PiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wic3ViLWxpc3Qtcm93XCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiAxMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdUYxRUJcIiwgc3R5bGU6IFwiY29sb3I6ICM4OWRjZWI7XCIgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBgJHtuZXQuc3NpZH0gKCR7bmV0LnNpZ25hbH0lKWAsIGNzc19jbGFzc2VzOiBbXCJzdWItbGlzdC1sYWJlbFwiXSwgaGV4cGFuZDogdHJ1ZSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBuZXQuYWN0aXZlID8gW1wiY29ubmVjdC1idG5cIiwgXCJhY3RpdmVcIl0gOiBbXCJjb25uZWN0LWJ0blwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBuZXQuYWN0aXZlID8gXCJcdTI3MTQgQ29ubmVzc29cIiA6IFwiQ29ubmV0dGlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmV0LmFjdGl2ZSkgZXhlY0FzeW5jKFtcIm5tY2xpXCIsIFwiZGV2XCIsIFwid2lmaVwiLCBcImNvbm5lY3RcIiwgbmV0LnNzaWRdKS50aGVuKCgpID0+IHNjYW5XaWZpKCkpLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiYWN0aW9uLXBpbGwtYnRuXCJdLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogXCJcdTI2OTkgIEltcG9zdGF6aW9uaSBkaSBSZXRlIEF2YW56YXRlXCIsXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4geyB0b2dnbGVFeGNsdXNpdmVNb2RhbChcIndpZmktbW9kYWxcIik7IGV4ZWNBc3luYyhbXCJubS1jb25uZWN0aW9uLWVkaXRvclwiXSkuY2F0Y2goKCkgPT4ge30pIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH0pXG59XG5cbi8vIC0tLSAyQi4gREVESUNBVEVEIEJMVUVUT09USCBNT0RBTCAtLS1cbmV4cG9ydCBmdW5jdGlvbiBCdE1vZGFsKCkge1xuICAgIGNvbnN0IHsgVE9QLCBSSUdIVCB9ID0gQXN0YWwuV2luZG93QW5jaG9yXG5cbiAgICByZXR1cm4gUG9wdXBXaW5kb3coe1xuICAgICAgICBuYW1lOiBcImJ0LW1vZGFsXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJidC1tb2RhbFwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IFRPUCB8IFJJR0hULFxuICAgICAgICBleGNsdXNpdml0eTogQXN0YWwuRXhjbHVzaXZpdHkuSUdOT1JFLFxuICAgICAgICBrZXltb2RlOiBBc3RhbC5LZXltb2RlLkVYQ0xVU0lWRSxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIG1hcmdpblRvcDogNDAsXG4gICAgICAgIG1hcmdpblJpZ2h0OiAxMDAsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJmb2N1c2VkLW1vZGFsLWJveFwiXSxcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiAxNCxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1RjI5NCAgRGlzcG9zaXRpdmkgQmx1ZXRvb3RoXCIsIGNzc19jbGFzc2VzOiBbXCJkb25nbGUtdGl0bGVcIl0sIGhleHBhbmQ6IHRydWUsIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oeyBsYWJlbDogXCJcdTI3MTVcIiwgY3NzX2NsYXNzZXM6IFtcImRvbmdsZS1jbG9zZS1idG5cIl0sIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJidC1tb2RhbFwiKSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBidFN0YXRlKCkuYXMoYiA9PiBiLmluY2x1ZGVzKFwiT25cIikgPyBbXCJxdWljay10b2dnbGUtYnRuXCIsIFwiYnRcIiwgXCJhY3RpdmVcIl0gOiBbXCJxdWljay10b2dnbGUtYnRuXCIsIFwiYnRcIl0pLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogYnRTdGF0ZSgpLmFzKGIgPT4gYi5pbmNsdWRlcyhcIk9uXCIpID8gXCJcdTI3MTQgQmx1ZXRvb3RoIEF0dGl2byBcdTIwMjIgQ2xpY2NhIHBlciBEaXNhdHRpdmFyZVwiIDogXCJcdTI3MTUgQmx1ZXRvb3RoIERpc2F0dGl2YXRvIFx1MjAyMiBDbGljY2EgcGVyIEF0dGl2YXJlXCIpLFxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIFwicmZraWxsIGxpc3QgYmx1ZXRvb3RoIHwgZ3JlcCAtcSAnU29mdCBibG9ja2VkOiB5ZXMnICYmIHJma2lsbCB1bmJsb2NrIGJsdWV0b290aCB8fCByZmtpbGwgYmxvY2sgYmx1ZXRvb3RoXCJdKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ0U3RhdGUuc2V0KGJ0U3RhdGUuZ2V0KCkuaW5jbHVkZXMoXCJPblwiKSA/IFwiQlQgXHUyMDIyIE9mZlwiIDogXCJCVCBcdTIwMjIgT25cIilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wic3ViLWxpc3QtYm94XCJdLFxuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiA2LFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogYnRMaXN0KCkuYXMoKGxpc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJTY2Fuc2lvbmUgZGlzcG9zaXRpdmkgQlQgaW4gY29yc28uLi5cIiwgY3NzX2NsYXNzZXM6IFtcInN1Yi1saXN0LWxhYmVsXCJdIH0pXVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxpc3QubWFwKChkZXYpID0+IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJzdWItbGlzdC1yb3dcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDEyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1RjI5NFwiLCBzdHlsZTogXCJjb2xvcjogIzg5YjRmYTtcIiB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGRldi5uYW1lLCBjc3NfY2xhc3NlczogW1wic3ViLWxpc3QtbGFiZWxcIl0sIGhleHBhbmQ6IHRydWUsIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogZGV2LmNvbm5lY3RlZCA/IFtcImNvbm5lY3QtYnRuXCIsIFwiYWN0aXZlXCJdIDogW1wiY29ubmVjdC1idG5cIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogZGV2LmNvbm5lY3RlZCA/IFwiXHUyNzE0IENvbm5lc3NvXCIgOiBcIkNvbm5ldHRpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wiYmx1ZXRvb3RoY3RsXCIsIGRldi5jb25uZWN0ZWQgPyBcImRpc2Nvbm5lY3RcIiA6IFwiY29ubmVjdFwiLCBkZXYubWFjXSkudGhlbigoKSA9PiBzY2FuQnQoKSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG4vLyAtLS0gMkMuIERFRElDQVRFRCBBVURJTyBIVUIgJiBBUFBMSUNBVElPTiBNSVhFUiBNT0RBTCAtLS1cbmV4cG9ydCBmdW5jdGlvbiBBdWRpb01vZGFsKCkge1xuICAgIGNvbnN0IHsgVE9QLCBSSUdIVCB9ID0gQXN0YWwuV2luZG93QW5jaG9yXG5cbiAgICBjb25zdCBta1NsaWRlciA9IChpY29uOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIHZhbFZhcjogVmFyaWFibGU8bnVtYmVyPiwgYWN0aW9uOiAodmFsOiBudW1iZXIpID0+IHZvaWQpID0+IHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBuZXcgR3RrLlNjYWxlKHtcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgIGFkanVzdG1lbnQ6IG5ldyBHdGsuQWRqdXN0bWVudCh7IGxvd2VyOiAwLCB1cHBlcjogMTAwLCBzdGVwX2luY3JlbWVudDogNSwgcGFnZV9pbmNyZW1lbnQ6IDEwLCB2YWx1ZTogdmFsVmFyLmdldCgpIH0pLFxuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIm1hdHNoZWxsLXNsaWRlclwiXVxuICAgICAgICB9KVxuICAgICAgICBsZXQgdGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgICAgICBzY2FsZS5jb25uZWN0KFwidmFsdWUtY2hhbmdlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB2YWwgPSBNYXRoLnJvdW5kKHNjYWxlLmdldF92YWx1ZSgpKVxuICAgICAgICAgICAgdmFsVmFyLnNldCh2YWwpXG4gICAgICAgICAgICBpZiAodGltZXIgIT09IG51bGwpIEdMaWIuc291cmNlX3JlbW92ZSh0aW1lcilcbiAgICAgICAgICAgIHRpbWVyID0gR0xpYi50aW1lb3V0X2FkZChHTGliLlBSSU9SSVRZX0RFRkFVTFQsIDUwLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgYWN0aW9uKHZhbClcbiAgICAgICAgICAgICAgICB0aW1lciA9IG51bGw7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEdMaWIuU09VUkNFX1JFTU9WRTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICAgIHZhbFZhci5zdWJzY3JpYmUoKHYpID0+IHsgaWYgKE1hdGgucm91bmQoc2NhbGUuZ2V0X3ZhbHVlKCkpICE9PSB2KSBzY2FsZS5zZXRfdmFsdWUodikgfSlcblxuICAgICAgICByZXR1cm4gV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiZG9uZ2xlLXNsaWRlci1zZWN0aW9uXCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDYsXG4gICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogYCR7aWNvbn0gICR7dGl0bGV9YCwgY3NzX2NsYXNzZXM6IFtcInNsaWRlci1sYWJlbFwiXSwgaGV4cGFuZDogdHJ1ZSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IHZhbFZhcigpLmFzKHYgPT4gYCR7dn0lYCksIGNzc19jbGFzc2VzOiBbXCJzbGlkZXItdmFsXCJdIH0pXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBzY2FsZVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiBQb3B1cFdpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwiYXVkaW8tbW9kYWxcIixcbiAgICAgICAgbmFtZXNwYWNlOiBcImF1ZGlvLW1vZGFsXCIsXG4gICAgICAgIGFwcGxpY2F0aW9uOiBBcHAsXG4gICAgICAgIGFuY2hvcjogVE9QIHwgUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgbWFyZ2luVG9wOiA0MCxcbiAgICAgICAgbWFyZ2luUmlnaHQ6IDYwLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiZm9jdXNlZC1tb2RhbC1ib3hcIl0sXG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgc3BhY2luZzogMTYsXG4gICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdTI2NkIgIENlbnRybyBBdWRpbyAmIE1peGVyIEFwcGxpY2F6aW9uaVwiLCBjc3NfY2xhc3NlczogW1wiZG9uZ2xlLXRpdGxlXCJdLCBoZXhwYW5kOiB0cnVlLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgbGFiZWw6IFwiXHUyNzE1XCIsIGNzc19jbGFzc2VzOiBbXCJkb25nbGUtY2xvc2UtYnRuXCJdLCBvbkNsaWNrZWQ6ICgpID0+IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwiYXVkaW8tbW9kYWxcIikgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIE91dHB1dCBTaW5rIFNlbGVjdG9yXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogMTAsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJVc2NpdGE6XCIsIGNzc19jbGFzc2VzOiBbXCJzdWItbGlzdC1sYWJlbFwiXSwgc3R5bGU6IFwibWluLXdpZHRoOiA3MHB4O1wiIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImF1ZGlvLWRldmljZS1zZWxlY3RvclwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZXhwYW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBhdWRpb1NpbmtzKCkuYXMoKHNpbmtzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFjdCA9IHNpbmtzLmZpbmQoKHMpID0+IHMuYWN0aXZlKSB8fCBzaW5rc1swXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWN0ID8gYFx1MjcxNCAke2FjdC5kZXNjfWAgOiBcIlNlbGV6aW9uYSBEaXNwb3NpdGl2byBVc2NpdGFcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaW5rcyA9IGF1ZGlvU2lua3MuZ2V0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpbmtzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkeCA9IHNpbmtzLmZpbmRJbmRleCgocykgPT4gcy5hY3RpdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXh0ID0gc2lua3NbKGlkeCArIDEpICUgc2lua3MubGVuZ3RoXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wicGFjdGxcIiwgXCJzZXQtZGVmYXVsdC1zaW5rXCIsIG5leHQubmFtZV0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBgZm9yIGlkIGluICQocGFjdGwgbGlzdCBzaW5rLWlucHV0cyBzaG9ydCB8IGF3ayAne3ByaW50ICQxfScpOyBkbyBwYWN0bCBtb3ZlLXNpbmstaW5wdXQgJGlkICR7bmV4dC5uYW1lfTsgZG9uZWBdKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQXVkaW9IdWIoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pLFxuXG4gICAgICAgICAgICAgICAgLy8gSW5wdXQgU291cmNlIFNlbGVjdG9yXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogMTAsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJNaWNyb2Zvbm86XCIsIGNzc19jbGFzc2VzOiBbXCJzdWItbGlzdC1sYWJlbFwiXSwgc3R5bGU6IFwibWluLXdpZHRoOiA3MHB4O1wiIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImF1ZGlvLWRldmljZS1zZWxlY3RvclwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZXhwYW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBhdWRpb1NvdXJjZXMoKS5hcygoc291cmNlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhY3QgPSBzb3VyY2VzLmZpbmQoKHMpID0+IHMuYWN0aXZlKSB8fCBzb3VyY2VzWzBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY3QgPyBgXHUyNzE0ICR7YWN0LmRlc2N9YCA6IFwiU2VsZXppb25hIEluZ3Jlc3NvIE1pY1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZXMgPSBhdWRpb1NvdXJjZXMuZ2V0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNvdXJjZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWR4ID0gc291cmNlcy5maW5kSW5kZXgoKHMpID0+IHMuYWN0aXZlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IHNvdXJjZXNbKGlkeCArIDEpICUgc291cmNlcy5sZW5ndGhdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJwYWN0bFwiLCBcInNldC1kZWZhdWx0LXNvdXJjZVwiLCBuZXh0Lm5hbWVdKS50aGVuKCgpID0+IHVwZGF0ZUF1ZGlvSHViKCkpLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pLFxuXG4gICAgICAgICAgICAgICAgbWtTbGlkZXIoXCJcdTI2NkJcIiwgXCJWb2x1bWUgTWFzdGVyIE91dHB1dFwiLCB2b2xWYWwsICh2KSA9PiB7IHRyeSB7IGNvbnN0IHdwID0gQXN0YWxXcC5nZXRfZGVmYXVsdCgpPy5hdWRpbzsgaWYgKHdwPy5kZWZhdWx0X3NwZWFrZXIpIHsgd3AuZGVmYXVsdF9zcGVha2VyLm11dGUgPSBmYWxzZTsgd3AuZGVmYXVsdF9zcGVha2VyLnZvbHVtZSA9IHYgLyAxMDA7IH0gfSBjYXRjaCAoZSkgeyBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBgd3BjdGwgc2V0LW11dGUgQERFRkFVTFRfQVVESU9fU0lOS0AgMCAyPi9kZXYvbnVsbDsgd3BjdGwgc2V0LXZvbHVtZSBAREVGQVVMVF9BVURJT19TSU5LQCAke3Z9JWBdKS5jYXRjaCgoKT0+e30pIH0gfSksXG4gICAgICAgICAgICAgICAgbWtTbGlkZXIoXCJcdUYxMzBcIiwgXCJHdWFkYWdubyBNaWNyb2Zvbm9cIiwgbWljVmFsLCAodikgPT4geyB0cnkgeyBjb25zdCB3cCA9IEFzdGFsV3AuZ2V0X2RlZmF1bHQoKT8uYXVkaW87IGlmICh3cD8uZGVmYXVsdF9taWNyb3Bob25lKSB7IHdwLmRlZmF1bHRfbWljcm9waG9uZS5tdXRlID0gZmFsc2U7IHdwLmRlZmF1bHRfbWljcm9waG9uZS52b2x1bWUgPSB2IC8gMTAwOyB9IH0gY2F0Y2ggKGUpIHsgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgYHdwY3RsIHNldC1tdXRlIEBERUZBVUxUX0FVRElPX1NPVVJDRUAgMCAyPi9kZXYvbnVsbDsgd3BjdGwgc2V0LXZvbHVtZSBAREVGQVVMVF9BVURJT19TT1VSQ0VAICR7dn0lYF0pLmNhdGNoKCgpPT57fSkgfSB9KSxcblxuICAgICAgICAgICAgICAgIC8vIEFwcGxpY2F0aW9uIFZvbHVtZSBNaXhlclxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiYXBwLW1peGVyLXNlY3Rpb25cIl0sXG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDgsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJMaXZlbGxhbWVudG8gRmx1c3NpIEFwcGxpY2F0aXZpIEF0dGl2aTpcIiwgY3NzX2NsYXNzZXM6IFtcInN1Yi1saXN0LWxhYmVsXCJdLCB4YWxpZ246IDAsIHN0eWxlOiBcImNvbG9yOiAjODliNGZhOyBmb250LXNpemU6IDAuODVlbTtcIiB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogNixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogYXBwU3RyZWFtcygpLmFzKChzdHJlYW1zKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdHJlYW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJOZXNzdW4gZmx1c3NvIGFwcGxpY2F0aXZvIGF0dGl2byBpbiByaXByb2R1emlvbmVcIiwgY3NzX2NsYXNzZXM6IFtcInN1Yi1saXN0LWxhYmVsXCJdLCBzdHlsZTogXCJjb2xvcjogI2E2YWRjODsgZm9udC1zdHlsZTogaXRhbGljOyBwYWRkaW5nOiA2cHggMDtcIiB9KV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyZWFtcy5tYXAoKHN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdFZvbCA9IFZhcmlhYmxlKHN0LnZvbClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gbmV3IEd0ay5TY2FsZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkanVzdG1lbnQ6IG5ldyBHdGsuQWRqdXN0bWVudCh7IGxvd2VyOiAwLCB1cHBlcjogMTAwLCBzdGVwX2luY3JlbWVudDogNSwgcGFnZV9pbmNyZW1lbnQ6IDEwLCB2YWx1ZTogc3Qudm9sIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJtYXRzaGVsbC1zbGlkZXJcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlLmNvbm5lY3QoXCJ2YWx1ZS1jaGFuZ2VkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWwgPSBNYXRoLnJvdW5kKHNjYWxlLmdldF92YWx1ZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0Vm9sLnNldCh2YWwpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgYHBhY3RsIHNldC1zaW5rLWlucHV0LW11dGUgJHtzdC5pZH0gMCAyPi9kZXYvbnVsbDsgcGFjdGwgc2V0LXNpbmstaW5wdXQtdm9sdW1lICR7c3QuaWR9ICR7dmFsfSVgXSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJhcHAtbWl4ZXItcm93XCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogNCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IHN0Lm5hbWUsIGNzc19jbGFzc2VzOiBbXCJhcHAtbWl4ZXItdGl0bGVcIl0sIGhleHBhbmQ6IHRydWUsIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogc3RWb2woKS5hcyh2ID0+IGAke3Z9JWApLCBzdHlsZTogXCJjb2xvcjogIzg5YjRmYTsgZm9udC1zaXplOiAwLjg1ZW07IGZvbnQtd2VpZ2h0OiA4MDA7IG1hcmdpbi1yaWdodDogMTBweDtcIiB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IHN0Lm11dGUgPyBbXCJhcHAtbWl4ZXItbXV0ZS1idG5cIiwgXCJtdXRlZFwiXSA6IFtcImFwcC1taXhlci1tdXRlLWJ0blwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IHN0Lm11dGUgPyBcIk11dG9cIiA6IFwiQXR0aXZvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcInBhY3RsXCIsIFwic2V0LXNpbmstaW5wdXQtbXV0ZVwiLCBzdC5pZCwgXCJ0b2dnbGVcIl0pLnRoZW4oKCkgPT4gdXBkYXRlQXVkaW9IdWIoKSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG4vLyAtLS0gMkQuIERFRElDQVRFRCBRVUlDSyBTRVRUSU5HUyAmIFNZU1RFTSBNT0RBTCAtLS1cbmV4cG9ydCBmdW5jdGlvbiBRdWlja1NldHRpbmdzTW9kYWwoKSB7XG4gICAgY29uc3QgeyBUT1AsIFJJR0hUIH0gPSBBc3RhbC5XaW5kb3dBbmNob3JcblxuICAgIGNvbnN0IHByb2ZpbGVDYXJkID0gV2lkZ2V0LkJveCh7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJwcm9maWxlLWNhcmRcIl0sXG4gICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgc3BhY2luZzogMTYsXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdTI1QzhcIiwgY3NzX2NsYXNzZXM6IFtcInByb2ZpbGUtYXZhdGFyXCJdIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJFcm1ldGUgT1NcIiwgY3NzX2NsYXNzZXM6IFtcInByb2ZpbGUtbmFtZVwiXSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJUcmlzbWVnaXN0dXMgXHUyMDIyIExpbnV4IEJlZHJvY2tcIiwgY3NzX2NsYXNzZXM6IFtcInByb2ZpbGUtc3ViXCJdLCB4YWxpZ246IDAgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiB1cHRpbWVTdGF0ZSgpLCBjc3NfY2xhc3NlczogW1widXB0aW1lLWJhZGdlXCJdIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAgY29uc3QgbWtTbGlkZXIgPSAoaWNvbjogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCB2YWxWYXI6IFZhcmlhYmxlPG51bWJlcj4sIGFjdGlvbjogKHZhbDogbnVtYmVyKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gbmV3IEd0ay5TY2FsZSh7XG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICBhZGp1c3RtZW50OiBuZXcgR3RrLkFkanVzdG1lbnQoeyBsb3dlcjogMCwgdXBwZXI6IDEwMCwgc3RlcF9pbmNyZW1lbnQ6IDUsIHBhZ2VfaW5jcmVtZW50OiAxMCwgdmFsdWU6IHZhbFZhci5nZXQoKSB9KSxcbiAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJtYXRzaGVsbC1zbGlkZXJcIl1cbiAgICAgICAgfSlcbiAgICAgICAgbGV0IHRpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICAgICAgc2NhbGUuY29ubmVjdChcInZhbHVlLWNoYW5nZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdmFsID0gTWF0aC5yb3VuZChzY2FsZS5nZXRfdmFsdWUoKSlcbiAgICAgICAgICAgIHZhbFZhci5zZXQodmFsKVxuICAgICAgICAgICAgaWYgKHRpbWVyICE9PSBudWxsKSBHTGliLnNvdXJjZV9yZW1vdmUodGltZXIpXG4gICAgICAgICAgICB0aW1lciA9IEdMaWIudGltZW91dF9hZGQoR0xpYi5QUklPUklUWV9ERUZBVUxULCA1MCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGFjdGlvbih2YWwpXG4gICAgICAgICAgICAgICAgdGltZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHJldHVybiBHTGliLlNPVVJDRV9SRU1PVkU7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICB2YWxWYXIuc3Vic2NyaWJlKCh2KSA9PiB7IGlmIChNYXRoLnJvdW5kKHNjYWxlLmdldF92YWx1ZSgpKSAhPT0gdikgc2NhbGUuc2V0X3ZhbHVlKHYpIH0pXG5cbiAgICAgICAgcmV0dXJuIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImRvbmdsZS1zbGlkZXItc2VjdGlvblwiXSxcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiA2LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGAke2ljb259ICAke3RpdGxlfWAsIGNzc19jbGFzc2VzOiBbXCJzbGlkZXItbGFiZWxcIl0sIGhleHBhbmQ6IHRydWUsIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiB2YWxWYXIoKS5hcyh2ID0+IGAke3Z9JWApLCBjc3NfY2xhc3NlczogW1wic2xpZGVyLXZhbFwiXSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgc2NhbGVcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4gUG9wdXBXaW5kb3coe1xuICAgICAgICBuYW1lOiBcInF1aWNrLXNldHRpbmdzXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJxdWljay1zZXR0aW5nc1wiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IFRPUCB8IFJJR0hULFxuICAgICAgICBleGNsdXNpdml0eTogQXN0YWwuRXhjbHVzaXZpdHkuSUdOT1JFLFxuICAgICAgICBrZXltb2RlOiBBc3RhbC5LZXltb2RlLkVYQ0xVU0lWRSxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIG1hcmdpblRvcDogNDAsXG4gICAgICAgIG1hcmdpblJpZ2h0OiAxNixcbiAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImZvY3VzZWQtbW9kYWwtYm94XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDE2LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBwcm9maWxlQ2FyZCxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyNzU2ICBJbXBvc3RhemlvbmkgJiBUZWxlbWV0cmlhXCIsIGNzc19jbGFzc2VzOiBbXCJkb25nbGUtdGl0bGVcIl0sIGhleHBhbmQ6IHRydWUsIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oeyBsYWJlbDogXCJcdTI3MTVcIiwgY3NzX2NsYXNzZXM6IFtcImRvbmdsZS1jbG9zZS1idG5cIl0sIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJxdWljay1zZXR0aW5nc1wiKSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDEyLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IGNhZmZlaW5lU3RhdGUoKS5hcyhjID0+IGMgPyBbXCJxdWljay10b2dnbGUtYnRuXCIsIFwiY2FmZmVpbmVcIiwgXCJhY3RpdmVcIl0gOiBbXCJxdWljay10b2dnbGUtYnRuXCIsIFwiY2FmZmVpbmVcIl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGNhZmZlaW5lU3RhdGUoKS5hcyhjID0+IGMgPyBcIlx1MjY2OCBBd2FrZSBcdTIwMjIgT25cIiA6IFwiXHUyNjY4IEF3YWtlIFx1MjAyMiBOb3JtYWxcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiBjYWZmZWluZVN0YXRlLnNldCghY2FmZmVpbmVTdGF0ZS5nZXQoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInF1aWNrLXRvZ2dsZS1idG5cIiwgXCJzaG90XCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiXHVGMDMwICBDYXR0dXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwicXVpY2stc2V0dGluZ3NcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJzbGVlcCAwLjUgJiYgZ3JpbSAtZyBcXFwiJChzbHVycClcXFwiIH4vUGljdHVyZXMvc2NyZWVuc2hvdF8kKGRhdGUgKyVzKS5wbmdcIl0pLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgRmlyZXdhbGxUb2dnbGUoKVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDEyLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgVXBkYXRlckJ1dHRvbigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInF1aWNrLXRvZ2dsZS1idG5cIiwgXCJjbGlwYm9hcmRcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogXCJcdUQ4M0RcdURDQ0IgQXBwdW50aVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4gdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJjbGlwYm9hcmRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBta1NsaWRlcihcIlx1MjYwMFwiLCBcIkx1bWlub3NpdFx1MDBFMCBNb25pdG9yIChEREMvQ0kgJiBlRFApXCIsIGJyaWdodFZhbCwgKHYpID0+IHsgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgYGRkY3V0aWwgc2V0dmNwIDEwICR7dn0gMj4vZGV2L251bGwgfHwgYnJpZ2h0bmVzc2N0bCBzICR7dn0lIDI+L2Rldi9udWxsIHx8IHRydWVgXSkuY2F0Y2goKCk9Pnt9KSB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiAxMixcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oeyBjc3NfY2xhc3NlczogW1wiYWN0aW9uLXBpbGwtYnRuXCJdLCBoZXhwYW5kOiB0cnVlLCBsYWJlbDogXCJcdUYyREIgIGJ0b3BcIiwgb25DbGlja2VkOiAoKSA9PiB7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwicXVpY2stc2V0dGluZ3NcIik7IGV4ZWNBc3luYyhbXCJmb290XCIsIFwiYnRvcFwiXSkuY2F0Y2goKCkgPT4ge30pIH0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgY3NzX2NsYXNzZXM6IFtcImFjdGlvbi1waWxsLWJ0blwiXSwgaGV4cGFuZDogdHJ1ZSwgbGFiZWw6IFwiXHVEODNEXHVEQ0MxICBGaWxlc1wiLCBvbkNsaWNrZWQ6ICgpID0+IHsgdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJxdWljay1zZXR0aW5nc1wiKTsgZXhlY0FzeW5jKFtcInRodW5hclwiLCBHTGliLmdldF9ob21lX2RpcigpXSkuY2F0Y2goKCkgPT4ge30pIH0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgY3NzX2NsYXNzZXM6IFtcImFjdGlvbi1waWxsLWJ0blwiXSwgaGV4cGFuZDogdHJ1ZSwgbGFiZWw6IFwiXHUyNjk5ICBJbXBvc3RhemlvbmlcIiwgb25DbGlja2VkOiAoKSA9PiB7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwicXVpY2stc2V0dGluZ3NcIik7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwic2V0dGluZ3MtbW9kYWxcIikgfSB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG4vLyAtLS0gRVJNRVRFIE9TIFNZU1RFTSBTRVRUSU5HUyBIVUIgKFwic2V0dGluZ3MtbW9kYWxcIikgLS0tXG4vLyAtLS0gRVJNRVRFIE9TIFNZU1RFTSBTRVRUSU5HUyBIVUIgKFwic2V0dGluZ3MtbW9kYWxcIikgLS0tXG5leHBvcnQgZnVuY3Rpb24gRXJtZXRlU2V0dGluZ3NNb2RhbCgpIHtcbiAgICAvLyBBIHNpbmdsZSByb3cgaW4gYSBncm91cFxuICAgIGNvbnN0IG1rU2V0dGluZ1JvdyA9IChpY29uOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgYWN0aW9uV2lkZ2V0OiBHdGsuV2lkZ2V0KSA9PiBXaWRnZXQuQm94KHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1zZXR0aW5nLXJvd1wiXSxcbiAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICBzcGFjaW5nOiAxNixcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBpY29uLCBjc3NfY2xhc3NlczogW1wid2luLXJvdy1pY29uXCJdIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogdGl0bGUsIGNzc19jbGFzc2VzOiBbXCJ3aW4tcm93LXRpdGxlXCJdLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBkZXNjLCBjc3NfY2xhc3NlczogW1wid2luLXJvdy1kZXNjXCJdLCB4YWxpZ246IDAsIHdyYXA6IHRydWUsIHZpc2libGU6IGRlc2MgIT09IFwiXCIgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgIHZhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW2FjdGlvbldpZGdldF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAgLy8gQSBncm91cCBvZiByb3dzIChsb29rcyBsaWtlIGEgc2luZ2xlIGNhcmQgd2l0aCBkaXZpZGVycylcbiAgICBjb25zdCBta1NldHRpbmdHcm91cCA9ICh0aXRsZTogc3RyaW5nLCByb3dzOiBHdGsuV2lkZ2V0W10pID0+IHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW46IEd0ay5XaWRnZXRbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvd3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuLnB1c2gocm93c1tpXSk7XG4gICAgICAgICAgICBpZiAoaSA8IHJvd3MubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goV2lkZ2V0LkJveCh7IGNzc19jbGFzc2VzOiBbXCJ3aW4tcm93LWRpdmlkZXJcIl0gfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiA4LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogdGl0bGUsIGNzc19jbGFzc2VzOiBbXCJ3aW4tZ3JvdXAtdGl0bGVcIl0sIHhhbGlnbjogMCwgdmlzaWJsZTogdGl0bGUgIT09IFwiXCIgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJ3aW4tc2V0dGluZy1ncm91cC1jYXJkXCJdLFxuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogY2hpbGRyZW5cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IG1rQnV0dG9uID0gKGljb246IHN0cmluZywgbGFiZWw6IHN0cmluZywgYWN0aW9uOiAoKSA9PiB2b2lkKSA9PiBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1hY3Rpb24tYnRuXCJdLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBzcGFjaW5nOiA2LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogaWNvbiB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbCB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KSxcbiAgICAgICAgb25DbGlja2VkOiAoKSA9PiBhY3Rpb24oKVxuICAgIH0pXG5cbiAgICBjb25zdCBta1RvZ2dsZSA9IChhY3RpdmU6IGJvb2xlYW4sIGFjdGlvbjogKHN0YXRlOiBib29sZWFuKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgIGNvbnN0IHN3ID0gbmV3IEd0ay5Td2l0Y2goeyBhY3RpdmUsIHZhbGlnbjogR3RrLkFsaWduLkNFTlRFUiB9KVxuICAgICAgICBzdy5jb25uZWN0KFwibm90aWZ5OjphY3RpdmVcIiwgKCkgPT4gYWN0aW9uKHN3LmFjdGl2ZSkpXG4gICAgICAgIHJldHVybiBzd1xuICAgIH1cblxuICAgIGNvbnN0IG1rRHJvcGRvd24gPSAob3B0aW9uczogc3RyaW5nW10sIHNlbGVjdGVkSWR4OiBudW1iZXIsIGFjdGlvbjogKGlkeDogbnVtYmVyLCB2YWw6IHN0cmluZykgPT4gdm9pZCkgPT4ge1xuICAgICAgICBjb25zdCBkZCA9IG5ldyBHdGsuRHJvcERvd24oe1xuICAgICAgICAgICAgbW9kZWw6IEd0ay5TdHJpbmdMaXN0Lm5ldyhvcHRpb25zKSxcbiAgICAgICAgICAgIHNlbGVjdGVkOiBzZWxlY3RlZElkeCxcbiAgICAgICAgICAgIHZhbGlnbjogR3RrLkFsaWduLkNFTlRFUlxuICAgICAgICB9KVxuICAgICAgICBkZC5jb25uZWN0KFwibm90aWZ5OjpzZWxlY3RlZFwiLCAoKSA9PiBhY3Rpb24oZGQuc2VsZWN0ZWQsIG9wdGlvbnNbZGQuc2VsZWN0ZWRdKSlcbiAgICAgICAgcmV0dXJuIGRkXG4gICAgfVxuXG4gICAgLy8gLS0tIFBBR0VTIC0tLVxuXG4gICAgY29uc3QgcGFnZVNpc3RlbWEgPSBXaWRnZXQuQm94KHtcbiAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgc3BhY2luZzogMjQsXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJTaXN0ZW1hXCIsIGNzc19jbGFzc2VzOiBbXCJ3aW4tcGFnZS10aXRsZVwiXSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgbWtTZXR0aW5nR3JvdXAoXCJEaXNwbGF5ICYgRmluZXN0cmVcIiwgW1xuICAgICAgICAgICAgICAgIG1rU2V0dGluZ1JvdyhcIlx1RDgzRFx1RERBNVx1RkUwRlwiLCBcIlNjYWxhIERpc3BsYXkgKERQSSlcIiwgXCJSZWdvbGEgbGEgZGltZW5zaW9uZSBnbG9iYWxlIGRlbGwnaW50ZXJmYWNjaWEgKHJpY2hpZWRlIHJpYXZ2aW8gcGVyIGFsY3VuZSBhcHApLlwiLFxuICAgICAgICAgICAgICAgICAgICBta0Ryb3Bkb3duKFtcIjEuMHggKDEwMCUpXCIsIFwiMS4yNXggKDEyNSUpXCIsIFwiMS41eCAoMTUwJSlcIiwgXCIyLjB4ICgyMDAlKVwiXSwgMCwgKGlkeCwgdmFsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2FsZSA9IHZhbC5zcGxpdChcInhcIilbMF1cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIGBzZWQgLWkgJ3Mvc2NhbGUgLiovc2NhbGUgJHtzY2FsZX0vJyB+Ly5jb25maWcvbmlyaS9jb25maWcua2RsYF0pLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgbWtTZXR0aW5nUm93KFwiXHVEODNEXHVERDMyXCIsIFwiU3BhemlhdHVyYSBGaW5lc3RyZVwiLCBcIkRpc3RhbnphIGluIHBpeGVsIHRyYSBsZSBmaW5lc3RyZSBhZmZpYW5jYXRlIChHYXBzKS5cIixcbiAgICAgICAgICAgICAgICAgICAgbWtEcm9wZG93bihbXCJOZXNzdW5hICgwcHgpXCIsIFwiU3RyZXR0YSAoOHB4KVwiLCBcIk1lZGlhICgxNnB4KVwiLCBcIkxhcmdhICgyNHB4KVwiXSwgMSwgKGlkeCwgdmFsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBnYXAgPSB2YWwuaW5jbHVkZXMoXCIwXCIpID8gXCIwXCIgOiB2YWwuaW5jbHVkZXMoXCI4XCIpID8gXCI4XCIgOiB2YWwuaW5jbHVkZXMoXCIxNlwiKSA/IFwiMTZcIiA6IFwiMjRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgYHNlZCAtaSAncy9nYXBzIC4qL2dhcHMgJHtnYXB9Lycgfi8uY29uZmlnL25pcmkvY29uZmlnLmtkbGBdKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIG1rU2V0dGluZ1JvdyhcIlx1RDgzRFx1RERCMlx1RkUwRlwiLCBcIkdlc3Rpb25lIE11bHRpLU1vbml0b3JcIiwgXCJEdXBsaWNhIG8gZXN0ZW5kaSBhdXRvbWF0aWNhbWVudGUgZ2xpIHNjaGVybWkgY29ubmVzc2kuXCIsXG4gICAgICAgICAgICAgICAgICAgIG1rQnV0dG9uKFwiXHVEODNEXHVEREE1XHVGRTBGXCIsIFwiQ29uZmlndXJhIERpc3BsYXlcIiwgKCkgPT4gZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJraWxsYWxsIHdsLW1pcnJvciAyPi9kZXYvbnVsbDsgTTI9JChuaXJpIG1zZyAtaiBvdXRwdXRzIHwganEgLXIgJ2tleXMgfCAuWzFdJyk7IGlmIFsgLW4gXFxcIiRNMlxcXCIgXSAmJiBbIFxcXCIkTTJcXFwiICE9IFxcXCJudWxsXFxcIiBdOyB0aGVuIG5pcmkgbXNnIG91dHB1dCBcXFwiJE0yXFxcIiBvbjsgbmlyaSBtc2cgb3V0cHV0IFxcXCIkTTJcXFwiIHBvc2l0aW9uIGF1dG87IGZpXCJdKS5jYXRjaCgoKSA9PiB7fSkpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgXSksXG4gICAgICAgICAgICBta1NldHRpbmdHcm91cChcIlByZXN0YXppb25pICYgQWxpbWVudGF6aW9uZVwiLCBbXG4gICAgICAgICAgICAgICAgbWtTZXR0aW5nUm93KFwiXHUyNkExXCIsIFwiTW9kYWxpdFx1MDBFMCBDYWZmZWluZVwiLCBcIkltcGVkaXNjZSBsYSBzb3NwZW5zaW9uZSBhdXRvbWF0aWNhIGRlbGxvIHNjaGVybW8uXCIsXG4gICAgICAgICAgICAgICAgICAgIG1rVG9nZ2xlKGNhZmZlaW5lU3RhdGUuZ2V0KCksIChzdGF0ZSkgPT4gY2FmZmVpbmVTdGF0ZS5zZXQoc3RhdGUpKVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgbWtTZXR0aW5nUm93KFwiXHVEODNEXHVERDBCXCIsIFwiU3RhdG8gQmF0dGVyaWFcIiwgXCJEZXR0YWdsaSBoYXJkd2FyZSBlIGNvbnN1bW8uXCIsXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBiYXR0U3RhdGUoKS5hcyhiID0+IGIpLCBjc3NfY2xhc3NlczogW1wid2luLXN0YXR1cy1sYWJlbFwiXSB9KVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIF0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAgY29uc3QgcGFnZVBlcnNvbmFsaXp6YXppb25lID0gV2lkZ2V0LkJveCh7XG4gICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgIHNwYWNpbmc6IDI0LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiUGVyc29uYWxpenphemlvbmVcIiwgY3NzX2NsYXNzZXM6IFtcIndpbi1wYWdlLXRpdGxlXCJdLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICBta1NldHRpbmdHcm91cChcIkVzdGV0aWNhIGRlbCBEZXNrdG9wXCIsIFtcbiAgICAgICAgICAgICAgICBta1NldHRpbmdSb3coXCJcdUQ4M0NcdURGMDhcIiwgXCJUZW1hIERpbmFtaWNvIChNYXR1Z2VuKVwiLCBcIlJpZ2VuZXJhIGkgY29sb3JpIGRpIHNpc3RlbWEgYmFzYW5kb3RpIHN1bGxvIHNmb25kbyBhdHR1YWxlLlwiLFxuICAgICAgICAgICAgICAgICAgICBta0J1dHRvbihcIlx1RDgzQ1x1REZBOFwiLCBcIkVzdHJhaSBDb2xvcmlcIiwgKCkgPT4gZXhlY0FzeW5jKFtcInNoXCIsIFwiLWNcIiwgXCJtYXR1Z2VuIGltYWdlIH4vLmNvbmZpZy9lcm1ldGUvd2FsbHBhcGVyLnBuZyB8fCB0cnVlXCJdKS5jYXRjaCgoKSA9PiB7fSkpXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBta1NldHRpbmdSb3coXCJcdUQ4M0RcdUREQkNcdUZFMEZcIiwgXCJTZm9uZG8gU2NyaXZhbmlhXCIsIFwiU29zdGl0dWlzY2kgbyByaWNhcmljYSBsbyBzZm9uZG8gY29ycmVudGUgKFN3YXliZykuXCIsXG4gICAgICAgICAgICAgICAgICAgIG1rQnV0dG9uKFwiXHVEODNEXHVERDA0XCIsIFwiUmljYXJpY2FcIiwgKCkgPT4gZXhlY0FzeW5jKFtcInN5c3RlbWN0bFwiLCBcIi0tdXNlclwiLCBcInJlc3RhcnRcIiwgXCJlcm1ldGUtd2FsbHBhcGVyLnNlcnZpY2VcIl0pLmNhdGNoKCgpID0+IHt9KSlcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIG1rU2V0dGluZ1JvdyhcIlx1RDgzQ1x1REZBOFwiLCBcIlBhbm5lbGxvIFN1cGVyaW9yZSAoQUdTKVwiLCBcIkFwcGxpY2EgbGUgbW9kaWZpY2hlIENTUyByaWNhcmljYW5kbyBsJ2ludGVyZmFjY2lhLlwiLFxuICAgICAgICAgICAgICAgICAgICBta0J1dHRvbihcIlx1RDgzRFx1REQwNFwiLCBcIlJpYXZ2aWEgQUdTXCIsICgpID0+IGV4ZWNBc3luYyhbXCJzeXN0ZW1jdGxcIiwgXCItLXVzZXJcIiwgXCJyZXN0YXJ0XCIsIFwiZXJtZXRlLWFncy5zZXJ2aWNlXCJdKS5jYXRjaCgoKSA9PiB7fSkpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgXSksXG4gICAgICAgICAgICBta1NldHRpbmdHcm91cChcIlRlcm1pbmFsZVwiLCBbXG4gICAgICAgICAgICAgICAgbWtTZXR0aW5nUm93KFwiXHUyMzI4XHVGRTBGXCIsIFwiRGltZW5zaW9uZSBGb250XCIsIFwiR3JhbmRlenphIGRlbCBjYXJhdHRlcmUgbmVsIHRlcm1pbmFsZSBGb290LlwiLFxuICAgICAgICAgICAgICAgICAgICBta0Ryb3Bkb3duKFtcIlBpY2NvbG8gKDEwKVwiLCBcIk1lZGlvICgxMSlcIiwgXCJHcmFuZGUgKDEzKVwiLCBcIkVub3JtZSAoMTYpXCJdLCAxLCAoaWR4LCB2YWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNpemUgPSB2YWwuaW5jbHVkZXMoXCIxMFwiKSA/IFwiMTBcIiA6IHZhbC5pbmNsdWRlcyhcIjExXCIpID8gXCIxMVwiIDogdmFsLmluY2x1ZGVzKFwiMTNcIikgPyBcIjEzXCIgOiBcIjE2XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIGBzZWQgLWkgJ3MvZm9udD1KZXRCcmFpbnMgTW9ubzpzaXplPS4qL2ZvbnQ9SmV0QnJhaW5zIE1vbm86c2l6ZT0ke3NpemV9Lycgfi8uY29uZmlnL2Zvb3QvZm9vdC5pbmlgXSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBta1NldHRpbmdSb3coXCJcdUQ4M0RcdURDNDFcdUZFMEZcIiwgXCJUcmFzcGFyZW56YSAoT3BhY2l0XHUwMEUwKVwiLCBcIlJlZ29sYSBpbCBsaXZlbGxvIGRpIGdsYXNzbW9ycGhpc20gbmVsIHRlcm1pbmFsZS5cIixcbiAgICAgICAgICAgICAgICAgICAgbWtEcm9wZG93bihbXCJTb2xpZG8gKDEwMCUpXCIsIFwiVHJhc3BhcmVudGUgKDkwJSlcIiwgXCJWZXRybyAoODAlKVwiXSwgMSwgKGlkeCwgdmFsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbHBoYSA9IHZhbC5pbmNsdWRlcyhcIjEwMFwiKSA/IFwiMS4wXCIgOiB2YWwuaW5jbHVkZXMoXCI5MFwiKSA/IFwiMC45XCIgOiBcIjAuOFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBgc2VkIC1pICdzL2FscGhhPS4qL2FscGhhPSR7YWxwaGF9Lycgfi8uY29uZmlnL2Zvb3QvZm9vdC5pbmlgXSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgXSlcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICBjb25zdCBwYWdlSW5mbyA9IFdpZGdldC5Cb3goe1xuICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICBzcGFjaW5nOiAyNCxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIkluZm9ybWF6aW9uaSBTaXN0ZW1hXCIsIGNzc19jbGFzc2VzOiBbXCJ3aW4tcGFnZS10aXRsZVwiXSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1hYm91dC1jYXJkXCJdLFxuICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgc3BhY2luZzogMTIsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiAxNixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyNUM4XCIsIGNzc19jbGFzc2VzOiBbXCJ3aW4tYWJvdXQtbG9nb1wiXSB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiRXJtZXRlIE9TXCIsIGNzc19jbGFzc2VzOiBbXCJ3aW4tYWJvdXQtdGl0bGVcIl0sIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlRyaXNtZWdpc3R1cyBFZGl0aW9uIChCZWRyb2NrIExpbnV4KVwiLCBjc3NfY2xhc3NlczogW1wid2luLWFib3V0LXN1YlwiXSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiT1NUcmVlIEltbXV0YWJpbGVcIiwgY3NzX2NsYXNzZXM6IFtcIndpbi1hYm91dC1zdWJcIl0sIHhhbGlnbjogMCB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1rU2V0dGluZ0dyb3VwKFwiQXppb25pIGRpIFNpc3RlbWFcIiwgW1xuICAgICAgICAgICAgICAgIG1rU2V0dGluZ1JvdyhcIlx1RDgzRFx1REQwRFwiLCBcIlN0YXRvIEltbXV0YWJpbGl0XHUwMEUwIChPU1RyZWUpXCIsIFwiVmVyaWZpY2EgbCdhbGJlcm8gZGVpIGNvbW1pdCBlIGdsaSBhZ2dpb3JuYW1lbnRpIGluIGF0dGVzYS5cIixcbiAgICAgICAgICAgICAgICAgICAgbWtCdXR0b24oXCJcdUQ4M0RcdURFODBcIiwgXCJDb250cm9sbGFcIiwgKCkgPT4geyB0b2dnbGVFeGNsdXNpdmVNb2RhbChcInNldHRpbmdzLW1vZGFsXCIpOyBleGVjQXN5bmMoW1wiZm9vdFwiLCBcInNoXCIsIFwiLWNcIiwgXCJycG0tb3N0cmVlIHN0YXR1czsgZWNobyAnJzsgcmVhZCAtcCAnUHJlbWVyZSBJbnZpbyBwZXIgY2hpdWRlcmUuLi4nXCJdKS5jYXRjaCgoKSA9PiB7fSkgfSlcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIG1rU2V0dGluZ1JvdyhcIlx1RjJEQlwiLCBcIk1vbml0b3JhZ2dpbyBSaXNvcnNlIChidG9wKVwiLCBcIkFwcmkgaWwgZ2VzdG9yZSBkaSBwcm9jZXNzaSBhdmFuemF0byBuZWwgdGVybWluYWxlLlwiLFxuICAgICAgICAgICAgICAgICAgICBta0J1dHRvbihcIlx1RDgzRFx1REU4MFwiLCBcIkFwcmkgYnRvcFwiLCAoKSA9PiB7IHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwic2V0dGluZ3MtbW9kYWxcIik7IGV4ZWNBc3luYyhbXCJmb290XCIsIFwiYnRvcFwiXSkuY2F0Y2goKCkgPT4ge30pIH0pXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgXSlcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICBjb25zdCBzdGFjayA9IG5ldyBHdGsuU3RhY2soe1xuICAgICAgICB0cmFuc2l0aW9uX3R5cGU6IEd0ay5TdGFja1RyYW5zaXRpb25UeXBlLlNMSURFX1VQX0RPV04sXG4gICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgIHZleHBhbmQ6IHRydWVcbiAgICB9KVxuICAgIFxuICAgIC8vIFNjcm9sbGVkIHdpbmRvdyB3cmFwcGVyIHBlciBvZ25pIHBhZ2luYVxuICAgIGNvbnN0IHdyYXBQYWdlID0gKGNoaWxkOiBHdGsuV2lkZ2V0KSA9PiBuZXcgR3RrLlNjcm9sbGVkV2luZG93KHsgXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHsgY2hpbGQ6IGNoaWxkLCBwYWRkaW5nOiAyNCB9KSwgXG4gICAgICAgIGhzY3JvbGxiYXJfcG9saWN5OiBHdGsuUG9saWN5VHlwZS5ORVZFUixcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1zdGFjay1zY3JvbGxcIl1cbiAgICB9KVxuXG4gICAgc3RhY2suYWRkX25hbWVkKHdyYXBQYWdlKHBhZ2VTaXN0ZW1hKSwgXCJzaXN0ZW1hXCIpXG4gICAgc3RhY2suYWRkX25hbWVkKHdyYXBQYWdlKHBhZ2VQZXJzb25hbGl6emF6aW9uZSksIFwicGVyc29uYWxpenphemlvbmVcIilcbiAgICBzdGFjay5hZGRfbmFtZWQod3JhcFBhZ2UocGFnZUluZm8pLCBcImluZm9cIilcblxuICAgIGNvbnN0IGFjdGl2ZVBhZ2UgPSBWYXJpYWJsZShcInNpc3RlbWFcIilcbiAgICBhY3RpdmVQYWdlLnN1YnNjcmliZSgodmFsKSA9PiBzdGFjay5zZXRfdmlzaWJsZV9jaGlsZF9uYW1lKHZhbCkpXG5cbiAgICBjb25zdCBta05hdkJ0biA9IChpY29uOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIHBhZ2U6IHN0cmluZykgPT4gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgIGNzc19jbGFzc2VzOiBhY3RpdmVQYWdlKCkuYXMocCA9PiBwID09PSBwYWdlID8gW1wid2luLW5hdi1idG5cIiwgXCJhY3RpdmVcIl0gOiBbXCJ3aW4tbmF2LWJ0blwiXSksXG4gICAgICAgIG9uQ2xpY2tlZDogKCkgPT4gYWN0aXZlUGFnZS5zZXQocGFnZSksXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIHNwYWNpbmc6IDEyLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogaWNvbiwgY3NzX2NsYXNzZXM6IFtcIndpbi1uYXYtaWNvblwiXSB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogbGFiZWwsIGNzc19jbGFzc2VzOiBbXCJ3aW4tbmF2LWxhYmVsXCJdIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgfSlcblxuICAgIGNvbnN0IHNpZGViYXIgPSBXaWRnZXQuQm94KHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1zaWRlYmFyXCJdLFxuICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICBzcGFjaW5nOiA0LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIndpbi1wcm9maWxlLWFyZWFcIl0sXG4gICAgICAgICAgICAgICAgc3BhY2luZzogMTIsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHUyNUM4XCIsIGNzc19jbGFzc2VzOiBbXCJ3aW4tYXZhdGFyXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIkVybWV0ZSBPU1wiLCBjc3NfY2xhc3NlczogW1wid2luLXByb2ZpbGUtbmFtZVwiXSwgeGFsaWduOiAwIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIkFkbWluIExvY2FsZVwiLCBjc3NfY2xhc3NlczogW1wid2luLXByb2ZpbGUtc3ViXCJdLCB4YWxpZ246IDAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJ3aW4tc2VhcmNoLWJveFwiXSxcbiAgICAgICAgICAgICAgICBzcGFjaW5nOiA4LFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1RDgzRFx1REQwRFwiLCBjc3NfY2xhc3NlczogW1wid2luLXNlYXJjaC1pY29uXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJUcm92YSBpbXBvc3RhemlvbmVcIiwgY3NzX2NsYXNzZXM6IFtcIndpbi1zZWFyY2gtcGxhY2Vob2xkZXJcIl0gfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIFdpZGdldC5Cb3goeyBjc3NfY2xhc3NlczogW1wid2luLXNpZGViYXItZGl2aWRlclwiXSB9KSxcbiAgICAgICAgICAgIG1rTmF2QnRuKFwiXHVEODNEXHVEREE1XHVGRTBGXCIsIFwiU2lzdGVtYVwiLCBcInNpc3RlbWFcIiksXG4gICAgICAgICAgICBta05hdkJ0bihcIlx1RDgzQ1x1REZBOFwiLCBcIlBlcnNvbmFsaXp6YXppb25lXCIsIFwicGVyc29uYWxpenphemlvbmVcIiksXG4gICAgICAgICAgICBta05hdkJ0bihcIlx1RDgzRFx1REVFMVx1RkUwRlwiLCBcIkluZm9ybWF6aW9uaVwiLCBcImluZm9cIilcbiAgICAgICAgXVxuICAgIH0pXG5cbiAgICByZXR1cm4gUG9wdXBXaW5kb3coe1xuICAgICAgICBuYW1lOiBcInNldHRpbmdzLW1vZGFsXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJzZXR0aW5ncy1tb2RhbFwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IEFzdGFsLldpbmRvd0FuY2hvci5OT05FLFxuICAgICAgICBleGNsdXNpdml0eTogQXN0YWwuRXhjbHVzaXZpdHkuSUdOT1JFLFxuICAgICAgICBrZXltb2RlOiBBc3RhbC5LZXltb2RlLkVYQ0xVU0lWRSxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJ3aW4tc2V0dGluZ3Mtd2luZG93XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBzaWRlYmFyLFxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wid2luLXNldHRpbmdzLWNvbnRlbnRcIl0sXG4gICAgICAgICAgICAgICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHZleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbc3RhY2tdXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG4vLyAtLS0gMy4gTUVESUEgUExBWUVSIERPTkdMRSAtLS1cbmV4cG9ydCBmdW5jdGlvbiBNZWRpYVBsYXllckRvbmdsZSgpIHtcbiAgICBjb25zdCB7IFRPUCB9ID0gQXN0YWwuV2luZG93QW5jaG9yXG5cbiAgICBjb25zdCBjb250ZW50ID0gV2lkZ2V0LkJveCh7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJtb2RhbC1ib3hcIiwgXCJtZWRpYS1tb2RhbC1ib3hcIl0sXG4gICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgIHNwYWNpbmc6IDE4LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgIHNwYWNpbmc6IDE2LFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlx1MjY2QlwiLCBjc3NfY2xhc3NlczogW1wibWVkaWEtbW9kYWwtdGl0bGVcIl0sIHN0eWxlOiBcImZvbnQtc2l6ZTogMi40ZW07XCIgfSksXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IG1lZGlhVHJhY2soKSwgY3NzX2NsYXNzZXM6IFtcIm1lZGlhLXRyYWNrLXRpdGxlXCJdLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IG1lZGlhQXJ0aXN0KCksIGNzc19jbGFzc2VzOiBbXCJtZWRpYS10cmFjay1hcnRpc3RcIl0sIHhhbGlnbjogMCB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgIHNwYWNpbmc6IDE0LFxuICAgICAgICAgICAgICAgIGhhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgY3NzX2NsYXNzZXM6IFtcIm1lZGlhLWFjdGlvbi1idG5cIl0sIGxhYmVsOiBcIlx1MjNFRSAgUHJldlwiLCBvbkNsaWNrZWQ6ICgpID0+IGV4ZWNBc3luYyhbXCJwbGF5ZXJjdGxcIiwgXCJwcmV2aW91c1wiXSkuY2F0Y2goKCkgPT4ge30pIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHsgY3NzX2NsYXNzZXM6IFtcIm1lZGlhLWFjdGlvbi1idG5cIl0sIGxhYmVsOiBpc1BsYXlpbmcoKS5hcyhwID0+IHAgPyBcIlx1MjNGOCAgUGF1c2VcIiA6IFwiXHUyNUI2ICBQbGF5XCIpLCBvbkNsaWNrZWQ6ICgpID0+IGV4ZWNBc3luYyhbXCJwbGF5ZXJjdGxcIiwgXCJwbGF5LXBhdXNlXCJdKS5jYXRjaCgoKSA9PiB7fSkgfSksXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oeyBjc3NfY2xhc3NlczogW1wibWVkaWEtYWN0aW9uLWJ0blwiXSwgbGFiZWw6IFwiTmV4dCAgXHUyM0VEXCIsIG9uQ2xpY2tlZDogKCkgPT4gZXhlY0FzeW5jKFtcInBsYXllcmN0bFwiLCBcIm5leHRcIl0pLmNhdGNoKCgpID0+IHt9KSB9KVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICB9KVxuXG4gICAgcmV0dXJuIFBvcHVwV2luZG93KHtcbiAgICAgICAgbmFtZTogXCJtZWRpYS1wbGF5ZXJcIixcbiAgICAgICAgbmFtZXNwYWNlOiBcIm1lZGlhLXBsYXllclwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IFRPUCxcbiAgICAgICAgZXhjbHVzaXZpdHk6IEFzdGFsLkV4Y2x1c2l2aXR5LklHTk9SRSxcbiAgICAgICAga2V5bW9kZTogQXN0YWwuS2V5bW9kZS5FWENMVVNJVkUsXG4gICAgICAgIHZpc2libGU6IGZhbHNlLFxuICAgICAgICBtYXJnaW5Ub3A6IDQwLFxuICAgICAgICBjaGlsZDogY29udGVudFxuICAgIH0pXG59XG5cbi8vIC0tLSA0LiBIQVJEV0FSRSBURUxFTUVUUlkgRE9OR0xFIChcInN5cy1tb25pdG9yXCIpIC0tLVxuZXhwb3J0IGZ1bmN0aW9uIFN5c01vbml0b3JEb25nbGUoKSB7XG4gICAgY29uc3QgeyBUT1AsIFJJR0hUIH0gPSBBc3RhbC5XaW5kb3dBbmNob3JcblxuICAgIGNvbnN0IG1rU3RhdENhcmQgPSAobGFiZWxDbGFzczogc3RyaW5nLCBpY29uOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIHN0YXRWYXI6IFZhcmlhYmxlPHN0cmluZz4pID0+IFdpZGdldC5Cb3goe1xuICAgICAgICBjc3NfY2xhc3NlczogW1wic3lzbW9uLWNhcmRcIl0sXG4gICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBgJHtpY29ufSAgJHt0aXRsZX1gLCBjc3NfY2xhc3NlczogW1wic3lzbW9uLWxhYmVsXCIsIGxhYmVsQ2xhc3NdLCBoZXhwYW5kOiB0cnVlLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogc3RhdFZhcigpLCBjc3NfY2xhc3NlczogW1wic3lzbW9uLXZhbFwiXSB9KVxuICAgICAgICBdXG4gICAgfSlcblxuICAgIHJldHVybiBQb3B1cFdpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwic3lzLW1vbml0b3JcIixcbiAgICAgICAgbmFtZXNwYWNlOiBcInN5cy1tb25pdG9yXCIsXG4gICAgICAgIGFwcGxpY2F0aW9uOiBBcHAsXG4gICAgICAgIGFuY2hvcjogVE9QIHwgUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgbWFyZ2luVG9wOiA0MCxcbiAgICAgICAgbWFyZ2luUmlnaHQ6IDI2MCxcbiAgICAgICAgY2hpbGQ6IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcIm1vZGFsLWJveFwiLCBcInN5c21vbi1tb2RhbC1ib3hcIl0sXG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgc3BhY2luZzogMTQsXG4gICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBcIlRlbGVtZXRyaWEgSGFyZHdhcmUgTGl2ZVwiLCBjc3NfY2xhc3NlczogW1wiZG9uZ2xlLXRpdGxlXCJdLCB4YWxpZ246IDAgfSksXG4gICAgICAgICAgICAgICAgbWtTdGF0Q2FyZChcImNwdVwiLCBcIlx1RjJEQlwiLCBcIlByb2Nlc3NvcmUgQ1BVXCIsIGNwdVVzYWdlKSxcbiAgICAgICAgICAgICAgICBta1N0YXRDYXJkKFwicmFtXCIsIFwiXHVGNTM4XCIsIFwiTWVtb3JpYSBSQU1cIiwgcmFtVXNhZ2UpLFxuICAgICAgICAgICAgICAgIG1rU3RhdENhcmQoXCJkaXNrXCIsIFwiXHVGMEEwXCIsIFwiQXJjaGl2aW8gUm9vdCAoLylcIiwgZGlza1VzYWdlKSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZTogYmF0dFN0YXRlKCkuYXMoYiA9PiAhYi5pbmNsdWRlcyhcIkFDXCIpKSxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQ6IG1rU3RhdENhcmQoXCJiYXR0XCIsIFwiXHVGMjQwXCIsIFwiQmF0dGVyaWEgZGkgU2lzdGVtYVwiLCBiYXR0U3RhdGUpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG4vLyAtLS0gNS4gQVBQTElDQVRJT04gTEFVTkNIRVIgLS0tXG5leHBvcnQgZnVuY3Rpb24gTGF1bmNoZXJNb2RhbCgpIHtcbiAgICBjb25zdCB7IFRPUCwgTEVGVCB9ID0gQXN0YWwuV2luZG93QW5jaG9yXG5cbiAgICBjb25zdCBzZWFyY2hFbnRyeSA9IG5ldyBHdGsuRW50cnkoe1xuICAgICAgICBwbGFjZWhvbGRlcl90ZXh0OiBcIkNlcmNhIGFwcGxpY2F6aW9uaS4uLlwiLFxuICAgICAgICBjc3NfY2xhc3NlczogW1wibGF1bmNoZXItZW50cnlcIl1cbiAgICB9KVxuICAgIHNlYXJjaEVudHJ5LmNvbm5lY3QoXCJjaGFuZ2VkXCIsICgpID0+IHtcbiAgICAgICAgaWYgKHNlYXJjaEVudHJ5LmdldF90ZXh0KCkgJiYgYWN0aXZlQ2F0ZWdvcnkuZ2V0KCkgIT09IFwiVHV0dGlcIikge1xuICAgICAgICAgICAgYWN0aXZlQ2F0ZWdvcnkuc2V0KFwiVHV0dGlcIilcbiAgICAgICAgfVxuICAgICAgICBxdWVyeVZhci5zZXQoc2VhcmNoRW50cnkuZ2V0X3RleHQoKSlcbiAgICAgICAgdXBkYXRlQXBwTGlzdCgpXG4gICAgfSlcbiAgICBzZWFyY2hFbnRyeS5jb25uZWN0KFwiYWN0aXZhdGVcIiwgKCkgPT4ge1xuICAgICAgICBsZXQgZmlyc3Q7XG4gICAgICAgIGlmIChxdWVyeVZhci5nZXQoKSkge1xuICAgICAgICAgICAgZmlyc3QgPSBhcHBzU2VydmljZS5mdXp6eV9xdWVyeShxdWVyeVZhci5nZXQoKSlbMF1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWRDYXRzID0gQ0FURUdPUllfTUFQW2FjdGl2ZUNhdGVnb3J5LmdldCgpXSB8fCBbXVxuICAgICAgICAgICAgZmlyc3QgPSBhcHBzU2VydmljZS5nZXRfbGlzdCgpLmZpbmQoYXBwID0+IGFjdGl2ZUNhdGVnb3J5LmdldCgpID09PSBcIlR1dHRpXCIgfHwgKGFwcC5jYXRlZ29yaWVzICYmIGFwcC5jYXRlZ29yaWVzLnNvbWUoYyA9PiBhbGxvd2VkQ2F0cy5pbmNsdWRlcyhjKSkpKVxuICAgICAgICB9XG4gICAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICAgICAgZmlyc3QubGF1bmNoKClcbiAgICAgICAgICAgIHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwibGF1bmNoZXJcIilcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBjYXRlZ29yeVNpZGViYXIgPSBXaWRnZXQuQm94KHtcbiAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcImxhdW5jaGVyLXNpZGViYXJcIl0sXG4gICAgICAgIHNwYWNpbmc6IDQsXG4gICAgICAgIGNoaWxkcmVuOiBbXCJUdXR0aVwiLCAuLi5PYmplY3Qua2V5cyhDQVRFR09SWV9NQVApXS5tYXAoY2F0TmFtZSA9PiBcbiAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJsYXVuY2hlci1jYXQtYnRuXCJdLFxuICAgICAgICAgICAgICAgIGxhYmVsOiBjYXROYW1lLFxuICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhY3RpdmVDYXRlZ29yeS5zZXQoY2F0TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoRW50cnkuc2V0X3RleHQoXCJcIilcbiAgICAgICAgICAgICAgICAgICAgcXVlcnlWYXIuc2V0KFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZUFwcExpc3QoKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0dXA6IChzZWxmKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZUNsYXNzID0gKHZhbDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0FjdGl2ZSA9IHZhbCA9PT0gY2F0TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzZXMgPSBzZWxmLmNzc19jbGFzc2VzLmZpbHRlcihjID0+IGMgIT09IFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWN0aXZlKSBjbGFzc2VzLnB1c2goXCJhY3RpdmVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNzc19jbGFzc2VzID0gY2xhc3NlcztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVDbGFzcyhhY3RpdmVDYXRlZ29yeS5nZXQoKSlcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlQ2F0ZWdvcnkuc3Vic2NyaWJlKHVwZGF0ZUNsYXNzKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgIClcbiAgICB9KVxuXG4gICAgY29uc3QgYXBwc1Njcm9sbCA9IG5ldyBHdGsuU2Nyb2xsZWRXaW5kb3coe1xuICAgICAgICBoc2Nyb2xsYmFyX3BvbGljeTogR3RrLlBvbGljeVR5cGUuTkVWRVIsXG4gICAgICAgIHZzY3JvbGxiYXJfcG9saWN5OiBHdGsuUG9saWN5VHlwZS5BVVRPTUFUSUMsXG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJsYXVuY2hlci1zY3JvbGxcIl0sXG4gICAgICAgIGNoaWxkOiBsaXN0Ym94XG4gICAgfSlcblxuICAgIGNvbnN0IHdpbiA9IFBvcHVwV2luZG93KHtcbiAgICAgICAgbmFtZTogXCJsYXVuY2hlclwiLFxuICAgICAgICBuYW1lc3BhY2U6IFwibGF1bmNoZXJcIixcbiAgICAgICAgYXBwbGljYXRpb246IEFwcCxcbiAgICAgICAgYW5jaG9yOiBUT1AgfCBMRUZULFxuICAgICAgICBleGNsdXNpdml0eTogQXN0YWwuRXhjbHVzaXZpdHkuSUdOT1JFLFxuICAgICAgICBrZXltb2RlOiBBc3RhbC5LZXltb2RlLkVYQ0xVU0lWRSxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIG1hcmdpblRvcDogNDAsXG4gICAgICAgIG1hcmdpbkxlZnQ6IDEyLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibW9kYWwtYm94XCIsIFwibGF1bmNoZXItYm94XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDE4LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImxhdW5jaGVyLWhlYWRlclwiXSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiAxNCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJcdUYwMDJcIiwgc3R5bGU6IFwiZm9udC1zaXplOiAxLjRlbTsgY29sb3I6ICM4OWI0ZmE7XCIgfSksIHNlYXJjaEVudHJ5XVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJsYXVuY2hlci1sYXlvdXRcIl0sXG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDE0LFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW2NhdGVnb3J5U2lkZWJhciwgYXBwc1Njcm9sbF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH0pXG5cbiAgICB3aW4uY29ubmVjdChcIm5vdGlmeTo6dmlzaWJsZVwiLCAoKSA9PiB7XG4gICAgICAgIGlmICh3aW4udmlzaWJsZSkge1xuICAgICAgICAgICAgYWN0aXZlQ2F0ZWdvcnkuc2V0KFwiVHV0dGlcIilcbiAgICAgICAgICAgIHF1ZXJ5VmFyLnNldChcIlwiKVxuICAgICAgICAgICAgc2VhcmNoRW50cnkuc2V0X3RleHQoXCJcIilcbiAgICAgICAgICAgIHNlYXJjaEVudHJ5LmdyYWJfZm9jdXMoKVxuICAgICAgICAgICAgdXBkYXRlQXBwTGlzdCgpXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIHdpblxufVxuXG4vLyAtLS0gNWIuIFNQT1RMSUdIVCBTRUFSQ0ggLS0tXG5jb25zdCBzcG90bGlnaHRRdWVyeVZhciA9IFZhcmlhYmxlKFwiXCIpXG5jb25zdCBzcG90bGlnaHRMaXN0Ym94ID0gbmV3IEd0ay5MaXN0Qm94KHsgY3NzX2NsYXNzZXM6IFtcInNwb3RsaWdodC1saXN0XCJdIH0pXG5sZXQgYXBwc1Njcm9sbDogR3RrLlNjcm9sbGVkV2luZG93IHwgbnVsbCA9IG51bGxcblxuZXhwb3J0IGZ1bmN0aW9uIGV2YWx1YXRlTWF0aChxdWVyeTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCEvXlswLTkrXFwtKi8oKS5cXHMsXSskLy50ZXN0KHF1ZXJ5KSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IHNhZmVRdWVyeSA9IHF1ZXJ5LnJlcGxhY2UoLywvZywgJy4nKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzYWZlUXVlcnl9YCkoKTtcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkICYmICFpc05hTihyZXN1bHQpKSB7XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIHt9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVTcG90bGlnaHRMaXN0KCkge1xuICAgIGxldCBjaGlsZCA9IHNwb3RsaWdodExpc3Rib3guZ2V0X2ZpcnN0X2NoaWxkKClcbiAgICB3aGlsZSAoY2hpbGQpIHtcbiAgICAgICAgY29uc3QgbmV4dCA9IGNoaWxkLmdldF9uZXh0X3NpYmxpbmcoKVxuICAgICAgICBzcG90bGlnaHRMaXN0Ym94LnJlbW92ZShjaGlsZClcbiAgICAgICAgY2hpbGQgPSBuZXh0XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHEgPSBzcG90bGlnaHRRdWVyeVZhci5nZXQoKS50cmltKClcbiAgICBpZiAoIXEpIHtcbiAgICAgICAgaWYgKGFwcHNTY3JvbGwpIGFwcHNTY3JvbGwudmlzaWJsZSA9IGZhbHNlXG4gICAgICAgIHJldHVyblxuICAgIH1cbiAgICBcbiAgICBpZiAoYXBwc1Njcm9sbCkgYXBwc1Njcm9sbC52aXNpYmxlID0gdHJ1ZVxuICAgIGxldCByZXN1bHRzQWRkZWQgPSAwO1xuXG4gICAgY29uc3QgbWF0aFJlc3VsdCA9IGV2YWx1YXRlTWF0aChxKVxuICAgIGlmIChtYXRoUmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImFwcC1jYXJkXCIsIFwic3BvdGxpZ2h0LWNhcmRcIl0sXG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiAxNixcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHVEODNFXHVEREVFXCIsIHN0eWxlOiBcImZvbnQtc2l6ZTogMi4yZW07XCIgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgIHZhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IGxhYmVsOiBtYXRoUmVzdWx0LCB4YWxpZ246IDAsIGNzc19jbGFzc2VzOiBbXCJhcHAtbmFtZVwiLCBcInNwb3RsaWdodC1uYW1lXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiQ2FsY29sYXRyaWNlXCIsIHhhbGlnbjogMCwgY3NzX2NsYXNzZXM6IFtcImFwcC1kZXNjXCIsIFwic3BvdGxpZ2h0LWRlc2NcIl0gfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgICAgIHNwb3RsaWdodExpc3Rib3guYXBwZW5kKHJvdylcbiAgICAgICAgcmVzdWx0c0FkZGVkKytcbiAgICB9XG5cbiAgICBsZXQgYXBwcyA9IGFwcHNTZXJ2aWNlLmZ1enp5X3F1ZXJ5KHEpLnNsaWNlKDAsIDgpXG4gICAgYXBwcy5mb3JFYWNoKChhcHApID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiYXBwLWNhcmRcIiwgXCJzcG90bGlnaHQtY2FyZFwiXSxcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDE2LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuSW1hZ2UoeyBpY29uX25hbWU6IGFwcC5pY29uX25hbWUgfHwgXCJhcHBsaWNhdGlvbi14LWV4ZWN1dGFibGVcIiwgcGl4ZWxfc2l6ZTogNDgsIGNzc19jbGFzc2VzOiBbXCJhcHAtaWNvblwiXSB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGFwcC5uYW1lLCB4YWxpZ246IDAsIGNzc19jbGFzc2VzOiBbXCJhcHAtbmFtZVwiLCBcInNwb3RsaWdodC1uYW1lXCJdIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGFwcC5kZXNjcmlwdGlvbiB8fCBcIkFwcGxpY2F6aW9uZVwiLCB4YWxpZ246IDAsIGNzc19jbGFzc2VzOiBbXCJhcHAtZGVzY1wiLCBcInNwb3RsaWdodC1kZXNjXCJdIH0pXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgICBjb25zdCBnZXN0dXJlID0gbmV3IEd0ay5HZXN0dXJlQ2xpY2soKVxuICAgICAgICBnZXN0dXJlLmNvbm5lY3QoXCJyZWxlYXNlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICBhcHAubGF1bmNoKClcbiAgICAgICAgICAgIHRvZ2dsZUV4Y2x1c2l2ZU1vZGFsKFwic3BvdGxpZ2h0XCIpXG4gICAgICAgIH0pXG4gICAgICAgIHJvdy5hZGRfY29udHJvbGxlcihnZXN0dXJlKVxuICAgICAgICBzcG90bGlnaHRMaXN0Ym94LmFwcGVuZChyb3cpXG4gICAgICAgIHJlc3VsdHNBZGRlZCsrXG4gICAgfSlcblxuICAgIGlmIChyZXN1bHRzQWRkZWQgPT09IDAgfHwgKHJlc3VsdHNBZGRlZCA+IDAgJiYgIW1hdGhSZXN1bHQpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImFwcC1jYXJkXCIsIFwic3BvdGxpZ2h0LWNhcmRcIl0sXG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLkhPUklaT05UQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiAxNixcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHVGMTIwXCIsIHN0eWxlOiBcImZvbnQtc2l6ZTogMi4yZW07IGNvbG9yOiAjYTZhZGM4O1wiIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5Cb3goe1xuICAgICAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogYEVzZWd1aTogJHtxfWAsIHhhbGlnbjogMCwgY3NzX2NsYXNzZXM6IFtcImFwcC1uYW1lXCIsIFwic3BvdGxpZ2h0LW5hbWVcIl0gfSksXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJDb21hbmRvIGRpIHNpc3RlbWEgKHNoIC1jKVwiLCB4YWxpZ246IDAsIGNzc19jbGFzc2VzOiBbXCJhcHAtZGVzY1wiLCBcInNwb3RsaWdodC1kZXNjXCJdIH0pXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgICBjb25zdCBnZXN0dXJlID0gbmV3IEd0ay5HZXN0dXJlQ2xpY2soKVxuICAgICAgICBnZXN0dXJlLmNvbm5lY3QoXCJyZWxlYXNlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBxXSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICB0b2dnbGVFeGNsdXNpdmVNb2RhbChcInNwb3RsaWdodFwiKVxuICAgICAgICB9KVxuICAgICAgICByb3cuYWRkX2NvbnRyb2xsZXIoZ2VzdHVyZSlcbiAgICAgICAgc3BvdGxpZ2h0TGlzdGJveC5hcHBlbmQocm93KVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFNwb3RsaWdodE1vZGFsKCkge1xuICAgIGNvbnN0IHsgVE9QIH0gPSBBc3RhbC5XaW5kb3dBbmNob3JcblxuICAgIGNvbnN0IHNlYXJjaEVudHJ5ID0gbmV3IEd0ay5FbnRyeSh7XG4gICAgICAgIHBsYWNlaG9sZGVyX3RleHQ6IFwiQ2VyY2EgYXBwLCBjb21hbmRpLCBjYWxjb2xpLi4uXCIsXG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJzcG90bGlnaHQtZW50cnlcIl0sXG4gICAgICAgIGhleHBhbmQ6IHRydWVcbiAgICB9KVxuICAgIFxuICAgIHNlYXJjaEVudHJ5LmNvbm5lY3QoXCJjaGFuZ2VkXCIsICgpID0+IHtcbiAgICAgICAgc3BvdGxpZ2h0UXVlcnlWYXIuc2V0KHNlYXJjaEVudHJ5LmdldF90ZXh0KCkpXG4gICAgICAgIHVwZGF0ZVNwb3RsaWdodExpc3QoKVxuICAgIH0pXG4gICAgXG4gICAgc2VhcmNoRW50cnkuY29ubmVjdChcImFjdGl2YXRlXCIsICgpID0+IHtcbiAgICAgICAgY29uc3QgcSA9IHNwb3RsaWdodFF1ZXJ5VmFyLmdldCgpLnRyaW0oKVxuICAgICAgICBpZiAoIXEpIHJldHVyblxuICAgICAgICBcbiAgICAgICAgY29uc3QgbWF0aFJlc3VsdCA9IGV2YWx1YXRlTWF0aChxKVxuICAgICAgICBpZiAoIW1hdGhSZXN1bHQpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ID0gYXBwc1NlcnZpY2UuZnV6enlfcXVlcnkocSlbMF1cbiAgICAgICAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICAgICAgICAgIGZpcnN0LmxhdW5jaCgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJzaFwiLCBcIi1jXCIsIHFdKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0b2dnbGVFeGNsdXNpdmVNb2RhbChcInNwb3RsaWdodFwiKVxuICAgIH0pXG5cbiAgICBhcHBzU2Nyb2xsID0gbmV3IEd0ay5TY3JvbGxlZFdpbmRvdyh7XG4gICAgICAgIGhzY3JvbGxiYXJfcG9saWN5OiBHdGsuUG9saWN5VHlwZS5ORVZFUixcbiAgICAgICAgdnNjcm9sbGJhcl9wb2xpY3k6IEd0ay5Qb2xpY3lUeXBlLkFVVE9NQVRJQyxcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcInNwb3RsaWdodC1zY3JvbGxcIl0sXG4gICAgICAgIGNoaWxkOiBzcG90bGlnaHRMaXN0Ym94LFxuICAgICAgICB2ZXhwYW5kOiB0cnVlLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZVxuICAgIH0pXG5cbiAgICBjb25zdCB3aW4gPSBQb3B1cFdpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwic3BvdGxpZ2h0XCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJzcG90bGlnaHRcIixcbiAgICAgICAgYXBwbGljYXRpb246IEFwcCxcbiAgICAgICAgYW5jaG9yOiBUT1AsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgbWFyZ2luVG9wOiAxODAsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJtb2RhbC1ib3hcIiwgXCJzcG90bGlnaHQtYm94XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDEyLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInNwb3RsaWdodC1oZWFkZXJcIl0sXG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgc3BhY2luZzogMTYsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiXHVGMDAyXCIsIHN0eWxlOiBcImZvbnQtc2l6ZTogMS44ZW07IGNvbG9yOiAjYTZhZGM4O1wiIH0pLCBzZWFyY2hFbnRyeV1cbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBhcHBzU2Nyb2xsXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgfSlcblxuICAgIHdpbi5jb25uZWN0KFwibm90aWZ5Ojp2aXNpYmxlXCIsICgpID0+IHtcbiAgICAgICAgaWYgKHdpbi52aXNpYmxlKSB7XG4gICAgICAgICAgICBzcG90bGlnaHRRdWVyeVZhci5zZXQoXCJcIilcbiAgICAgICAgICAgIHNlYXJjaEVudHJ5LnNldF90ZXh0KFwiXCIpXG4gICAgICAgICAgICBzZWFyY2hFbnRyeS5ncmFiX2ZvY3VzKClcbiAgICAgICAgICAgIGlmIChhcHBzU2Nyb2xsKSBhcHBzU2Nyb2xsLnZpc2libGUgPSBmYWxzZVxuICAgICAgICAgICAgdXBkYXRlU3BvdGxpZ2h0TGlzdCgpXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIHdpblxufVxuXG4vLyAtLS0gNi4gU0VTU0lPTiBQT1dFUiBNRU5VIC0tLVxuZXhwb3J0IGZ1bmN0aW9uIFBvd2VyTWVudU1vZGFsKCkge1xuICAgIGNvbnN0IHsgVE9QIH0gPSBBc3RhbC5XaW5kb3dBbmNob3JcblxuICAgIGNvbnN0IG1rUG93ZXJCdG4gPSAoY2xzOiBzdHJpbmcsIGljb246IHN0cmluZywgbGFiZWw6IHN0cmluZywgY21kOiBzdHJpbmdbXSkgPT4gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgIGNzc19jbGFzc2VzOiBbXCJwb3dlci1hY3Rpb24tYnRuXCIsIGNsc10sXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiAxMCxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IGljb24sIHN0eWxlOiBcImZvbnQtc2l6ZTogMi4yZW07XCIgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWwgfSlcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSksXG4gICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgdG9nZ2xlRXhjbHVzaXZlTW9kYWwoXCJwb3dlcm1lbnVcIilcbiAgICAgICAgICAgIGV4ZWNBc3luYyhjbWQpLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIGNvbnN0IGdyaWQgPSBXaWRnZXQuQm94KHtcbiAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICBzcGFjaW5nOiAxOCxcbiAgICAgICAgaGFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgbWtQb3dlckJ0bihcImxvY2tcIiwgXCJcdUYwMjNcIiwgXCJCbG9jY2FcIiwgW1wic2hcIiwgXCItY1wiLCBcImxvZ2luY3RsIGxvY2stc2Vzc2lvbiAyPi9kZXYvbnVsbCB8fCB0cnVlXCJdKSxcbiAgICAgICAgICAgIG1rUG93ZXJCdG4oXCJzdXNwZW5kXCIsIFwiXHVGMTg2XCIsIFwiU29zcGVuZGlcIiwgW1wic3lzdGVtY3RsXCIsIFwic3VzcGVuZFwiXSksXG4gICAgICAgICAgICBta1Bvd2VyQnRuKFwicmVib290XCIsIFwiXHVGMDFFXCIsIFwiUmlhdnZpYVwiLCBbXCJzeXN0ZW1jdGxcIiwgXCJyZWJvb3RcIl0pLFxuICAgICAgICAgICAgbWtQb3dlckJ0bihcInNodXRkb3duXCIsIFwiXHUyM0ZCXCIsIFwiU3BlZ25pXCIsIFtcInN5c3RlbWN0bFwiLCBcInBvd2Vyb2ZmXCJdKVxuICAgICAgICBdXG4gICAgfSlcblxuICAgIHJldHVybiBQb3B1cFdpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwicG93ZXJtZW51XCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJwb3dlcm1lbnVcIixcbiAgICAgICAgYXBwbGljYXRpb246IEFwcCxcbiAgICAgICAgYW5jaG9yOiBUT1AsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcbiAgICAgICAgbWFyZ2luVG9wOiAxNDAsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJtb2RhbC1ib3hcIiwgXCJwb3dlcm1lbnUtb3ZlcmxheVwiXSxcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBzcGFjaW5nOiAyNixcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgbGFiZWw6IFwiR2VzdGlvbmUgU2Vzc2lvbmUgXHUyMDIyIEVybWV0ZSBPU1wiLCBjc3NfY2xhc3NlczogW1wicG93ZXJtZW51LXRpdGxlXCJdLCBoYWxpZ246IEd0ay5BbGlnbi5DRU5URVIgfSksXG4gICAgICAgICAgICAgICAgZ3JpZCxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInBvd2VyLWNhbmNlbC1idG5cIl0sXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIkFubnVsbGEgZSBUb3JuYSBhbCBEZXNrdG9wXCIsXG4gICAgICAgICAgICAgICAgICAgIGhhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB0b2dnbGVFeGNsdXNpdmVNb2RhbChcInBvd2VybWVudVwiKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgfSlcbn1cblxuLy8gLS0tIDcuIENBTEVOREFSICYgRVZFTlRTIC0tLVxuZXhwb3J0IGZ1bmN0aW9uIENhbGVuZGFyTW9kYWwoKSB7XG4gICAgY29uc3QgeyBUT1AgfSA9IEFzdGFsLldpbmRvd0FuY2hvclxuXG4gICAgY29uc3QgY2FsZW5kYXIgPSBuZXcgR3RrLkNhbGVuZGFyKHsgY3NzX2NsYXNzZXM6IFtcIm1hdHNoZWxsLWNhbGVuZGFyXCJdIH0pXG5cbiAgICByZXR1cm4gUG9wdXBXaW5kb3coe1xuICAgICAgICBuYW1lOiBcImNhbGVuZGFyXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJjYWxlbmRhclwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IFRPUCxcbiAgICAgICAgZXhjbHVzaXZpdHk6IEFzdGFsLkV4Y2x1c2l2aXR5LklHTk9SRSxcbiAgICAgICAga2V5bW9kZTogQXN0YWwuS2V5bW9kZS5FWENMVVNJVkUsXG4gICAgICAgIHZpc2libGU6IGZhbHNlLFxuICAgICAgICBtYXJnaW5Ub3A6IDQwLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibW9kYWwtYm94XCJdLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgIHNwYWNpbmc6IDE2LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBsYWJlbDogXCJDYWxlbmRhcmlvIGUgRXZlbnRpXCIsIGNzc19jbGFzc2VzOiBbXCJkb25nbGUtdGl0bGVcIl0sIHhhbGlnbjogMCB9KSxcbiAgICAgICAgICAgICAgICBjYWxlbmRhclxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH0pXG59XG5cbiIsICJpbXBvcnQgeyBWYXJpYWJsZSB9IGZyb20gXCJhc3RhbFwiXG5pbXBvcnQgeyBleGVjQXN5bmMgfSBmcm9tIFwiYXN0YWwvcHJvY2Vzc1wiXG5pbXBvcnQgeyBXaWRnZXQgfSBmcm9tIFwiYXN0YWwvZ3RrNFwiXG5cbmV4cG9ydCBjb25zdCBmaXJld2FsbFN0YXRlID0gVmFyaWFibGUoXCJ1bmtub3duXCIpLnBvbGwoNTAwMCwgXCJzeXN0ZW1jdGwgaXMtYWN0aXZlIGZpcmV3YWxsZFwiLCAob3V0LCBwcmV2KSA9PiB7XG4gICAgcmV0dXJuIG91dC50cmltKCkgPT09IFwiYWN0aXZlXCIgPyBcInJ1bm5pbmdcIiA6IFwic3RvcHBlZFwiXG59KVxuXG5leHBvcnQgY29uc3QgRmlyZXdhbGxUb2dnbGUgPSAoKSA9PiBXaWRnZXQuQnV0dG9uKHtcbiAgICBjc3NfY2xhc3NlczogZmlyZXdhbGxTdGF0ZSgocykgPT4gXG4gICAgICAgIHMgPT09IFwicnVubmluZ1wiID8gW1wicXVpY2stdG9nZ2xlLWJ0blwiLCBcImZpcmV3YWxsXCIsIFwiYWN0aXZlXCJdIDogW1wicXVpY2stdG9nZ2xlLWJ0blwiLCBcImZpcmV3YWxsXCJdXG4gICAgKSxcbiAgICBoZXhwYW5kOiB0cnVlLFxuICAgIGxhYmVsOiBmaXJld2FsbFN0YXRlKChzKSA9PiBcbiAgICAgICAgcyA9PT0gXCJydW5uaW5nXCIgPyBcIlx1RDgzRFx1REVFMVx1RkUwRiBGaXJld2FsbCBcdTIwMjIgT25cIiA6IFwiXHVEODNEXHVERUUxXHVGRTBGIEZpcmV3YWxsIFx1MjAyMiBPZmZcIlxuICAgICksXG4gICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGFjdGlvbiA9IGZpcmV3YWxsU3RhdGUuZ2V0KCkgPT09IFwicnVubmluZ1wiID8gXCJzdG9wXCIgOiBcInN0YXJ0XCJcbiAgICAgICAgLy8gTW9zdHJpYW1vIGlsIHBvbGtpdCBuYXRpdm8gcGVyIGkgcGVybWVzc2kgZGkgcm9vdFxuICAgICAgICBleGVjQXN5bmMoW1wicGtleGVjXCIsIFwic3lzdGVtY3RsXCIsIGFjdGlvbiwgXCJmaXJld2FsbGRcIl0pXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNBc3luYyhbXCJmaXJld2FsbC1jbWRcIiwgXCItLXN0YXRlXCJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4ob3V0ID0+IGZpcmV3YWxsU3RhdGUuc2V0KG91dC50cmltKCkgPT09IFwicnVubmluZ1wiID8gXCJydW5uaW5nXCIgOiBcInN0b3BwZWRcIikpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKCkgPT4gZmlyZXdhbGxTdGF0ZS5zZXQoXCJzdG9wcGVkXCIpKVxuICAgICAgICAgICAgICAgIH0sIDEwMDApXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBjb25zb2xlLmVycm9yKFwiRmlyZXdhbGwgdG9nZ2xlIGVycm9yOiBcIiwgZXJyKSlcbiAgICB9XG59KVxuIiwgImltcG9ydCB7IFZhcmlhYmxlIH0gZnJvbSBcImFzdGFsXCJcbmltcG9ydCB7IGV4ZWNBc3luYyB9IGZyb20gXCJhc3RhbC9wcm9jZXNzXCJcbmltcG9ydCB7IFdpZGdldCB9IGZyb20gXCJhc3RhbC9ndGs0XCJcblxuLy8gQ29udHJvbGxhIGxvIHN0YXRvIGRpIE9TVHJlZSBvZ25pIDYwIHNlY29uZGlcbmV4cG9ydCBjb25zdCB1cGRhdGVTdGF0ZSA9IFZhcmlhYmxlKHsgcGVuZGluZ1JlYm9vdDogZmFsc2UsIHN0YXR1c1RleHQ6IFwiQ29udHJvbGxvLi4uXCIgfSkucG9sbCg2MDAwMCwgXCJycG0tb3N0cmVlIHN0YXR1c1wiLCAob3V0KSA9PiB7XG4gICAgLy8gQ2VyY2hpYW1vIGxlIHJpZ2hlIGRlaSBkZXBsb3ltZW50XG4gICAgY29uc3QgbGluZXMgPSBvdXQuc3BsaXQoXCJcXG5cIikuZmlsdGVyKGwgPT4gbC50cmltKCkuc3RhcnRzV2l0aChcIm9zdHJlZS1cIikgfHwgbC50cmltKCkuc3RhcnRzV2l0aChcIlx1MjVDRiBvc3RyZWUtXCIpKVxuICAgIFxuICAgIC8vIFNlIGxhIHJpZ2EgY29sIHBhbGxpbm8gXCJcdTI1Q0ZcIiAocXVlbGxhIGF0dHVhbG1lbnRlIGF2dmlhdGEpIE5PTiBcdTAwRTggbGEgcHJpbWEgZGVsbGEgbGlzdGEsIFxuICAgIC8vIHNpZ25pZmljYSBjaGUgYydcdTAwRTggdW4gYWdnaW9ybmFtZW50byBzY2FyaWNhdG8gZSBwcm9udG8gcGVyIGlsIHJlYm9vdC5cbiAgICBjb25zdCBwZW5kaW5nUmVib290ID0gbGluZXMubGVuZ3RoID4gMCAmJiAhbGluZXNbMF0uaW5jbHVkZXMoXCJcdTI1Q0ZcIilcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBwZW5kaW5nUmVib290LFxuICAgICAgICBzdGF0dXNUZXh0OiBwZW5kaW5nUmVib290ID8gXCJSaWF2dmlvIE5lY2Vzc2FyaW9cIiA6IFwiU2lzdGVtYSBBZ2dpb3JuYXRvXCJcbiAgICB9XG59KVxuXG5leHBvcnQgY29uc3QgVXBkYXRlckJ1dHRvbiA9ICgpID0+IFdpZGdldC5CdXR0b24oe1xuICAgIGNzc19jbGFzc2VzOiB1cGRhdGVTdGF0ZSgocykgPT4gXG4gICAgICAgIHMucGVuZGluZ1JlYm9vdCA/IFtcInF1aWNrLXRvZ2dsZS1idG5cIiwgXCJ1cGRhdGVyXCIsIFwiYWN0aXZlXCIsIFwid2FybmluZ1wiXSA6IFtcInF1aWNrLXRvZ2dsZS1idG5cIiwgXCJ1cGRhdGVyXCJdXG4gICAgKSxcbiAgICBoZXhwYW5kOiB0cnVlLFxuICAgIGxhYmVsOiB1cGRhdGVTdGF0ZSgocykgPT4gYFx1RDgzRFx1REU4MCBPUzogJHtzLnN0YXR1c1RleHR9YCksXG4gICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgIC8vIFNlIHNpIGNsaWNjYSwgYXByZSB1biB0ZXJtaW5hbGUgcGVyIGxhbmNpYXJlIGwndXBncmFkZSBvIG1vc3RyYXJlIGxvIHN0YXR1c1xuICAgICAgICBleGVjQXN5bmMoW1wiZm9vdFwiLCBcInNoXCIsIFwiLWNcIiwgXCJlY2hvICdBdnZpbyByaWNlcmNhIGFnZ2lvcm5hbWVudGkgbmVsbGEgRm9yZ2lhLi4uJzsgcnBtLW9zdHJlZSB1cGdyYWRlOyBlY2hvICcnOyByZWFkIC1wICdQcmVtaSBJbnZpbyBwZXIgdXNjaXJlLi4uJ1wiXSlcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gY29uc29sZS5lcnJvcihlcnIpKVxuICAgIH1cbn0pXG4iLCAiaW1wb3J0IHsgQXBwLCBBc3RhbCwgR3RrLCBHZGssIFdpZGdldCB9IGZyb20gXCJhc3RhbC9ndGs0XCJcbmltcG9ydCB7IFZhcmlhYmxlLCBHTGliLCBiaW5kIH0gZnJvbSBcImFzdGFsXCJcbmltcG9ydCBBc3RhbE5vdGlmZCBmcm9tIFwiZ2k6Ly9Bc3RhbE5vdGlmZFwiXG5cbmNvbnN0IGFjdGl2ZVBvcHVwcyA9IG5ldyBNYXA8bnVtYmVyLCBHdGsuV2lkZ2V0PigpXG5cbmZ1bmN0aW9uIE5vdGlmaWNhdGlvbldpZGdldChub3RpZjogQXN0YWxOb3RpZmQuTm90aWZpY2F0aW9uKSB7XG4gICAgY29uc3QgaWNvbiA9IG5vdGlmLmltYWdlIHx8IG5vdGlmLmFwcF9pY29uIHx8IFwiZGlhbG9nLWluZm9ybWF0aW9uLXN5bWJvbGljXCJcblxuICAgIHJldHVybiBXaWRnZXQuQm94KHtcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIm5vdGlmaWNhdGlvbi1ib3hcIl0sXG4gICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgc3BhY2luZzogMTIsXG4gICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICBXaWRnZXQuSW1hZ2Uoe1xuICAgICAgICAgICAgICAgIGljb25fbmFtZTogaWNvbixcbiAgICAgICAgICAgICAgICBwaXhlbF9zaXplOiA0OCxcbiAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibm90aWZpY2F0aW9uLWljb25cIl1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICB2YWxpZ246IEd0ay5BbGlnbi5DRU5URVIsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJub3RpZmljYXRpb24tc3VtbWFyeVwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBub3RpZi5zdW1tYXJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgeGFsaWduOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgd3JhcDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heF93aWR0aF9jaGFyczogNDBcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibm90aWZpY2F0aW9uLWJvZHlcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogbm90aWYuYm9keSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHhhbGlnbjogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyYXA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhfd2lkdGhfY2hhcnM6IDQwXG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwYWNpbmc6IDgsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5fdG9wOiA4LFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IG5vdGlmLmdldF9hY3Rpb25zKCkubWFwKGEgPT4gV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGEubGFiZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wibm90aWZpY2F0aW9uLWFjdGlvbi1idG5cIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGlmLmludm9rZShhLmlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RpZi5kaXNtaXNzKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICBdXG4gICAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE5vdGlmaWNhdGlvblBvcHVwcygpIHtcbiAgICBjb25zdCBub3RpZmQgPSBBc3RhbE5vdGlmZC5nZXRfZGVmYXVsdCgpXG4gICAgXG4gICAgY29uc3QgbGlzdCA9IFdpZGdldC5Cb3goe1xuICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICBzcGFjaW5nOiAxMCxcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcIm5vdGlmaWNhdGlvbi1saXN0XCJdLFxuICAgICAgICBjaGlsZHJlbjogW11cbiAgICB9KVxuXG4gICAgY29uc3Qgd2luID0gV2lkZ2V0LldpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwibm90aWZpY2F0aW9uc1wiLFxuICAgICAgICBuYW1lc3BhY2U6IFwibm90aWZpY2F0aW9uc1wiLFxuICAgICAgICBhbmNob3I6IEFzdGFsLldpbmRvd0FuY2hvci5UT1AgfCBBc3RhbC5XaW5kb3dBbmNob3IuUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGxheWVyOiBBc3RhbC5MYXllci5PVkVSTEFZLFxuICAgICAgICBtYXJnaW5fdG9wOiA2MCxcbiAgICAgICAgbWFyZ2luX3JpZ2h0OiAxMixcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIGNoaWxkOiBsaXN0XG4gICAgfSlcblxuICAgIG5vdGlmZC5jb25uZWN0KFwibm90aWZpZWRcIiwgKF8sIGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IG5vdGlmID0gbm90aWZkLmdldF9ub3RpZmljYXRpb24oaWQpXG4gICAgICAgIGlmICghbm90aWYpIHJldHVyblxuXG4gICAgICAgIGNvbnN0IHdpZGdldCA9IE5vdGlmaWNhdGlvbldpZGdldChub3RpZilcbiAgICAgICAgYWN0aXZlUG9wdXBzLnNldChpZCwgd2lkZ2V0KVxuICAgICAgICBsaXN0LmFwcGVuZCh3aWRnZXQpXG4gICAgICAgIFxuICAgICAgICAvLyBTaG93IHRoZSB3aW5kb3cgbm93IHRoYXQgaXQgaGFzIGNvbnRlbnRcbiAgICAgICAgd2luLnZpc2libGUgPSB0cnVlXG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSB3aWRnZXQgYWZ0ZXIgNSBzZWNvbmRzIHZpc3VhbGx5LCB3aXRob3V0IGRpc21pc3NpbmcgZnJvbSB0aGUgZGFlbW9uIGlmIGl0IGhhc24ndCBleHBpcmVkXG4gICAgICAgIEdMaWIudGltZW91dF9hZGQoR0xpYi5QUklPUklUWV9ERUZBVUxULCA1MDAwLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoYWN0aXZlUG9wdXBzLmhhcyhpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3ID0gYWN0aXZlUG9wdXBzLmdldChpZClcbiAgICAgICAgICAgICAgICBpZiAodykgbGlzdC5yZW1vdmUodylcbiAgICAgICAgICAgICAgICBhY3RpdmVQb3B1cHMuZGVsZXRlKGlkKVxuICAgICAgICAgICAgICAgIGlmIChhY3RpdmVQb3B1cHMuc2l6ZSA9PT0gMCkgd2luLnZpc2libGUgPSBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIEdMaWIuU09VUkNFX1JFTU9WRVxuICAgICAgICB9KVxuICAgIH0pXG5cbiAgICBub3RpZmQuY29ubmVjdChcInJlc29sdmVkXCIsIChfLCBpZCkgPT4ge1xuICAgICAgICBjb25zdCB3aWRnZXQgPSBhY3RpdmVQb3B1cHMuZ2V0KGlkKVxuICAgICAgICBpZiAod2lkZ2V0KSB7XG4gICAgICAgICAgICBsaXN0LnJlbW92ZSh3aWRnZXQpXG4gICAgICAgICAgICBhY3RpdmVQb3B1cHMuZGVsZXRlKGlkKVxuICAgICAgICB9XG4gICAgICAgIGlmIChhY3RpdmVQb3B1cHMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgd2luLnZpc2libGUgPSBmYWxzZVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiB3aW5cbn1cbiIsICJpbXBvcnQgeyBBcHAsIEFzdGFsLCBHdGssIEdkaywgV2lkZ2V0IH0gZnJvbSBcImFzdGFsL2d0azRcIlxuaW1wb3J0IHsgVmFyaWFibGUsIGJpbmQgfSBmcm9tIFwiYXN0YWxcIlxuaW1wb3J0IEF1dGggZnJvbSBcImdpOi8vQXN0YWxBdXRoXCJcbmltcG9ydCB7IFBvcHVwV2luZG93IH0gZnJvbSBcIi4vc3RhdGVcIlxuXG5jb25zdCBjdXJyZW50UHJvbXB0ID0gVmFyaWFibGUoXCJcIilcbmNvbnN0IGN1cnJlbnRBdXRoSWQgPSBWYXJpYWJsZShcIlwiKVxuXG5leHBvcnQgZnVuY3Rpb24gUG9sa2l0QWdlbnQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCFBdXRoIHx8ICEoQXV0aCBhcyBhbnkpLlBvbGtpdCB8fCB0eXBlb2YgKEF1dGggYXMgYW55KS5Qb2xraXQuZ2V0X2RlZmF1bHQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXV0aCA9IChBdXRoIGFzIGFueSkuUG9sa2l0LmdldF9kZWZhdWx0KClcbiAgICAgICAgYXV0aC5jb25uZWN0KFwicmVxdWVzdFwiLCAoYWdlbnQ6IGFueSwgaWQ6IHN0cmluZywgbXNnOiBzdHJpbmcsIGljb246IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3Qgd2luID0gQXBwLmdldF93aW5kb3coXCJwb2xraXRcIilcbiAgICAgICAgICAgIGlmICh3aW4pIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UHJvbXB0LnNldChtc2cpXG4gICAgICAgICAgICAgICAgY3VycmVudEF1dGhJZC5zZXQoaWQpXG4gICAgICAgICAgICAgICAgd2luLnZpc2libGUgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiTm8gUG9sa2l0IEF1dGhlbnRpY2F0aW9uIEFnZW50IGJhY2tlbmQgYXZhaWxhYmxlIGluIEFzdGFsQXV0aDogXCIsIGUpXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gUG9sa2l0TW9kYWwoKSB7XG4gICAgcmV0dXJuIFBvcHVwV2luZG93KHtcbiAgICAgICAgbmFtZTogXCJwb2xraXRcIixcbiAgICAgICAgbmFtZXNwYWNlOiBcInBvbGtpdFwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IEFzdGFsLldpbmRvd0FuY2hvci5OT05FLFxuICAgICAgICBleGNsdXNpdml0eTogQXN0YWwuRXhjbHVzaXZpdHkuSUdOT1JFLFxuICAgICAgICBrZXltb2RlOiBBc3RhbC5LZXltb2RlLkVYQ0xVU0lWRSxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wicG9sa2l0LW1vZGFsLWNvbnRhaW5lclwiXSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIlx1RDgzRFx1REQxMiBBdXRlbnRpY2F6aW9uZSBSaWNoaWVzdGFcIiwgXG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJwb2xraXQtdGl0bGVcIl0gXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHsgXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBiaW5kKGN1cnJlbnRQcm9tcHQpLCBcbiAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInBvbGtpdC1tc2dcIl0sIFxuICAgICAgICAgICAgICAgICAgICB3cmFwOiB0cnVlIFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5FbnRyeSh7XG4gICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcl90ZXh0OiBcIlBhc3N3b3JkXCIsXG4gICAgICAgICAgICAgICAgICAgIG9uQWN0aXZhdGU6IChzZWxmKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpZCA9IGN1cnJlbnRBdXRoSWQuZ2V0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF1dGguUG9sa2l0LmdldF9kZWZhdWx0KCkucmVwbHkoaWQsIHNlbGYudGV4dClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudGV4dCA9IFwiXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIEFwcC5nZXRfd2luZG93KFwicG9sa2l0XCIpIS52aXNpYmxlID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogXCJBbm51bGxhXCIsXG4gICAgICAgICAgICAgICAgICAgIGNzczogXCJtYXJnaW4tdG9wOiAxcmVtO1wiLFxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gY3VycmVudEF1dGhJZC5nZXQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW1wdHkgc3RyaW5nIG8gbnVsbCB0cmlnZ2VyYSBjYW5jZWxsYXppb25lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQXV0aC5Qb2xraXQuZ2V0X2RlZmF1bHQoKS5yZXBseShpZCwgXCJcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIEFwcC5nZXRfd2luZG93KFwicG9sa2l0XCIpIS52aXNpYmxlID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgfSlcbn1cbiIsICJpbXBvcnQgeyBWYXJpYWJsZSB9IGZyb20gXCJhc3RhbFwiXG5pbXBvcnQgeyBleGVjQXN5bmMgfSBmcm9tIFwiYXN0YWwvcHJvY2Vzc1wiXG5cbi8vIFVEaXNrcyBNb25pdG9yIC0gSW50ZXJjZXR0YSBsJ2luc2VyaW1lbnRvIGRpIGNoaWF2ZXR0ZSBVU0JcbmV4cG9ydCBmdW5jdGlvbiBVRGlza3NNb25pdG9yKCkge1xuICAgIGNvbnNvbGUubG9nKFwiSW5pemlhbGl6emF6aW9uZSBVRGlza3MyIE1vbml0b3IgKEFHUyBOYXRpdmUpLi4uXCIpXG4gICAgXG4gICAgVmFyaWFibGUoXCJcIikud2F0Y2goXCJ1ZGlza3NjdGwgbW9uaXRvclwiLCAob3V0KSA9PiB7XG4gICAgICAgIC8vIEVzZW1waW8gb3V0cHV0OiBcIkFkZGVkIC9vcmcvZnJlZWRlc2t0b3AvVURpc2tzMi9ibG9ja19kZXZpY2VzL3NkYjFcIlxuICAgICAgICBpZiAob3V0LmluY2x1ZGVzKFwiQWRkZWQgL29yZy9mcmVlZGVza3RvcC9VRGlza3MyL2Jsb2NrX2RldmljZXMvXCIpICYmICFvdXQuaW5jbHVkZXMoXCJsb29wXCIpKSB7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IG91dC5tYXRjaCgvYmxvY2tfZGV2aWNlc1xcLyhbYS16QS1aMC05XSspLylcbiAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRldiA9IG1hdGNoWzFdXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRGlhbW8gMSBzZWNvbmRvIGEgVURpc2tzIHBlciBsZWdnZXJlIGxhIHRhYmVsbGEgcGFydGl6aW9uaVxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wibHNibGtcIiwgXCItSlwiLCBcIi1vXCIsIFwiTkFNRSxNT1VOVFBPSU5ULFRZUEUsU0laRVwiLCBgL2Rldi8ke2Rldn1gXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrID0gcGFyc2VkLmJsb2NrZGV2aWNlcz8uWzBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJbnRlcnZlbmlhbW8gc29sbyBzZSBcdTAwRTggdW5hIHBhcnRpemlvbmUgbm9uIG1vbnRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJsb2NrICYmIGJsb2NrLnR5cGUgPT09IFwicGFydFwiICYmICFibG9jay5tb3VudHBvaW50cz8uWzBdICYmICFibG9jay5tb3VudHBvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmlsZXZhdGEgbnVvdmEgcGFydGl6aW9uZTogJHtkZXZ9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2ZydXR0aWFtbyBub3RpZnktc2VuZCBjb24gQXppb25pICgtQSkuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWwgZGVtb25lIG5vdGlmaWNoZSBuYXRpdm8gZGkgQUdTIGxvIGludGVyY2V0dGVyXHUwMEUwIG1vc3RyYW5kbyBpIHB1bHNhbnRpIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vdGlmeS1zZW5kXCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiLUFcIiwgXCJtb3VudD1Nb250YVwiLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIi1BXCIsIFwiaWdub3JlPUlnbm9yYVwiLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIi11XCIsIFwibm9ybWFsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCItaVwiLCBcImRyaXZlLXJlbW92YWJsZS1tZWRpYVwiLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIk51b3ZhIE1lbW9yaWEgUmlsZXZhdGFcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYFRyb3ZhdG8gdm9sdW1lIC9kZXYvJHtkZXZ9ICgke2Jsb2NrLnNpemV9KS5cXG5WdW9pIG1vbnRhcmxvIG9yYT9gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdKS50aGVuKGFjdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFjdGlvbi50cmltKCkgPT09IFwibW91bnRcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1widWRpc2tzY3RsXCIsIFwibW91bnRcIiwgXCItYlwiLCBgL2Rldi8ke2Rldn1gXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKG1vdW50T3V0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wibm90aWZ5LXNlbmRcIiwgXCItaVwiLCBcImRyaXZlLWhhcmRkaXNrXCIsIFwiVm9sdW1lIE1vbnRhdG9cIiwgbW91bnRPdXQudHJpbSgpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wibm90aWZ5LXNlbmRcIiwgXCItaVwiLCBcImRpYWxvZy1lcnJvclwiLCBcIkVycm9yZVwiLCBcIkltcG9zc2liaWxlIG1vbnRhcmUgaWwgdm9sdW1lLlwiXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcmUgbmVsIHBhcnNpbmcgbHNibGs6IFwiLCBlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICAgICAgICAgIH0sIDEwMDApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dFxuICAgIH0pXG59XG4iLCAiaW1wb3J0IHsgQXBwLCBBc3RhbCwgR3RrLCBHZGssIFdpZGdldCB9IGZyb20gXCJhc3RhbC9ndGs0XCJcbmltcG9ydCB7IFZhcmlhYmxlLCBiaW5kIH0gZnJvbSBcImFzdGFsXCJcbmltcG9ydCB7IGV4ZWNBc3luYyB9IGZyb20gXCJhc3RhbC9wcm9jZXNzXCJcbmltcG9ydCB7IFBvcHVwV2luZG93LCB0b2dnbGVFeGNsdXNpdmVNb2RhbCB9IGZyb20gXCIuL3N0YXRlXCJcblxuLy8gVmFyaWFiaWxlIHJlYXR0aXZhIGNoZSBpbnRlcnJvZ2EgbGEgY2xpcGJvYXJkXG5leHBvcnQgY29uc3QgY2xpcGJvYXJkSXRlbXMgPSBWYXJpYWJsZTxzdHJpbmdbXT4oW10pLnBvbGwoMTAwMCwgW1wiL2hvbWUvZXJtZXRlLy5sb2NhbC9iaW4vY2xpcGhpc3RcIiwgXCJsaXN0XCJdLCAob3V0KSA9PiB7XG4gICAgcmV0dXJuIG91dC5zcGxpdChcIlxcblwiKS5maWx0ZXIobCA9PiBsLnRyaW0oKSAhPT0gXCJcIilcbn0pXG5cbmV4cG9ydCBmdW5jdGlvbiBDbGlwYm9hcmRNb2RhbCgpIHtcbiAgICByZXR1cm4gUG9wdXBXaW5kb3coe1xuICAgICAgICBuYW1lOiBcImNsaXBib2FyZFwiLFxuICAgICAgICBuYW1lc3BhY2U6IFwiY2xpcGJvYXJkXCIsXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiY2xpcGJvYXJkLW1vZGFsLWNvbnRhaW5lclwiXSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luX2JvdHRvbTogMTYsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIlx1RDgzRFx1RENDQiBDcm9ub2xvZ2lhIEFwcHVudGlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiY2xpcGJvYXJkLXRpdGxlXCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeGFsaWduOiAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIlx1RDgzRFx1REREMVx1RkUwRiBQdWxpc2NpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImNsaXBib2FyZC13aXBlLWJ0blwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrZWQ6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlY0FzeW5jKFtcIi9ob21lL2VybWV0ZS8ubG9jYWwvYmluL2NsaXBoaXN0XCIsIFwid2lwZVwiXSkuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoZXJyKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Nyb2xsID0gbmV3IEd0ay5TY3JvbGxlZFdpbmRvdyh7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXhwYW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImNsaXBib2FyZC1zY3JvbGxcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBoc2Nyb2xsYmFyX3BvbGljeTogR3RrLlBvbGljeVR5cGUuTkVWRVIsXG4gICAgICAgICAgICAgICAgICAgICAgICB2c2Nyb2xsYmFyX3BvbGljeTogR3RrLlBvbGljeVR5cGUuQVVUT01BVElDLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5uZXJCb3ggPSBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBHdGsuT3JpZW50YXRpb24uVkVSVElDQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiA4LFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IGJpbmQoY2xpcGJvYXJkSXRlbXMpLmFzKGl0ZW1zID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBbV2lkZ2V0LkxhYmVsKHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogXCJOZXNzdW4gZWxlbWVudG8gY29waWF0by5cIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiY2xpcGJvYXJkLWVtcHR5LW1zZ1wiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW1zLm1hcChpdGVtID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xpcGhpc3QgbGlzdCByZXN0aXR1aXNjZTogXCIxMjNcXHRUZXN0byBjb3BpYXRvLi4uXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBpdGVtLnNwbGl0KFwiXFx0XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpZXcgPSBwYXJ0cy5zbGljZSgxKS5qb2luKFwiXFx0XCIpIHx8IFwiT2dnZXR0byBiaW5hcmlvIC8gSW1tYWdpbmVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFdpZGdldC5CdXR0b24oe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImNsaXBib2FyZC1pdGVtLWJ0blwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkOiBXaWRnZXQuTGFiZWwoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBwcmV2aWV3LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRydW5jYXRlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heF93aWR0aF9jaGFyczogNTAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeGFsaWduOiAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2tlZDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNmdWdnaWFtbyBnbGkgYXBpY2kgc2luZ29saSBwZXIgbGEgc2hlbGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYWZlSXRlbSA9IGl0ZW0ucmVwbGFjZSgvJy9nLCBcIidcXFxcJydcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjQXN5bmMoW1wic2hcIiwgXCItY1wiLCBgZWNobyAtbiAnJHtzYWZlSXRlbX0nIHwgL2hvbWUvZXJtZXRlLy5sb2NhbC9iaW4vY2xpcGhpc3QgZGVjb2RlIHwgd2wtY29weWBdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB0b2dnbGVFeGNsdXNpdmVNb2RhbChcImNsaXBib2FyZFwiKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBjb25zb2xlLmVycm9yKFwiRXJyb3JlIGRlY29kaWZpY2E6IFwiLCBlcnIpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBzY3JvbGwuc2V0X2NoaWxkKGlubmVyQm94KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2Nyb2xsXG4gICAgICAgICAgICAgICAgfSkoKVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH0pXG59XG4iLCAiaW1wb3J0IHsgQXBwLCBBc3RhbCwgR3RrLCBHZGssIFdpZGdldCB9IGZyb20gXCJhc3RhbC9ndGs0XCJcbmltcG9ydCB7IFZhcmlhYmxlLCBHTGliLCBiaW5kIH0gZnJvbSBcImFzdGFsXCJcbmltcG9ydCBHaW8gZnJvbSBcImdpOi8vR2lvXCJcbmltcG9ydCB7IFBvcHVwV2luZG93IH0gZnJvbSBcIi4vc3RhdGVcIlxuXG4vLyBTdGF0byBwZXIgbGEgcmljaGllc3RhIGF0dGl2YVxuZXhwb3J0IGNvbnN0IGdlb2NsdWVSZXF1ZXN0ID0gVmFyaWFibGU8eyBhcHA6IHN0cmluZywgbGV2ZWw6IG51bWJlciwgaW52b2NhdGlvbjogR2lvLkRCdXNNZXRob2RJbnZvY2F0aW9uIH0gfCBudWxsPihudWxsKVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdEdlb2NsdWVBZ2VudCgpIHtcbiAgICBjb25zdCB4bWwgPSBgXG4gICAgPG5vZGU+XG4gICAgICA8aW50ZXJmYWNlIG5hbWU9XCJvcmcuZnJlZWRlc2t0b3AuR2VvQ2x1ZTIuQWdlbnRcIj5cbiAgICAgICAgPG1ldGhvZCBuYW1lPVwiQXV0aG9yaXplQXBwXCI+XG4gICAgICAgICAgPGFyZyB0eXBlPVwic1wiIG5hbWU9XCJkZXNrdG9wX2lkXCIgZGlyZWN0aW9uPVwiaW5cIi8+XG4gICAgICAgICAgPGFyZyB0eXBlPVwidVwiIG5hbWU9XCJyZXFfbGV2ZWxcIiBkaXJlY3Rpb249XCJpblwiLz5cbiAgICAgICAgICA8YXJnIHR5cGU9XCJiXCIgbmFtZT1cImF1dGhvcml6ZWRcIiBkaXJlY3Rpb249XCJvdXRcIi8+XG4gICAgICAgIDwvbWV0aG9kPlxuICAgICAgICA8cHJvcGVydHkgbmFtZT1cIk1heEFjY3VyYWN5TGV2ZWxcIiB0eXBlPVwidVwiIGFjY2Vzcz1cInJlYWRcIi8+XG4gICAgICA8L2ludGVyZmFjZT5cbiAgICA8L25vZGU+YDtcblxuICAgIGNvbnN0IG5vZGVJbmZvID0gR2lvLkRCdXNOb2RlSW5mby5uZXdfZm9yX3htbCh4bWwpO1xuICAgIGlmICghbm9kZUluZm8gfHwgbm9kZUluZm8uaW50ZXJmYWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltHZW9jbHVlXSBGYWlsZWQgdG8gcGFyc2UgWE1MXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGludGVyZmFjZUluZm8gPSBub2RlSW5mby5pbnRlcmZhY2VzWzBdO1xuXG4gICAgR2lvLmJ1c19nZXQoR2lvLkJ1c1R5cGUuU1lTVEVNLCBudWxsLCAoc291cmNlLCByZXMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbm4gPSBHaW8uYnVzX2dldF9maW5pc2gocmVzKTtcblxuICAgICAgICAgICAgY29ubi5yZWdpc3Rlcl9vYmplY3QoXG4gICAgICAgICAgICAgICAgXCIvb3JnL2ZyZWVkZXNrdG9wL0dlb0NsdWUyL0FnZW50XCIsXG4gICAgICAgICAgICAgICAgaW50ZXJmYWNlSW5mbyxcbiAgICAgICAgICAgICAgICAvLyBNZXRob2QgY2FsbCBoYW5kbGVyXG4gICAgICAgICAgICAgICAgKGNvbm4sIHNlbmRlciwgb2JqZWN0UGF0aCwgaW50ZXJmYWNlTmFtZSwgbWV0aG9kTmFtZSwgcGFyYW1ldGVycywgaW52b2NhdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWV0aG9kTmFtZSA9PT0gXCJBdXRob3JpemVBcHBcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgW2Rlc2t0b3BJZCwgcmVxTGV2ZWxdID0gcGFyYW1ldGVycy5kZWVwX3VucGFjaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtHZW9jbHVlXSBBcHAgJHtkZXNrdG9wSWR9IHJlcXVlc3RzIGxvY2F0aW9uIChsZXZlbCAke3JlcUxldmVsfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2VvY2x1ZVJlcXVlc3Quc2V0KHsgYXBwOiBkZXNrdG9wSWQsIGxldmVsOiByZXFMZXZlbCwgaW52b2NhdGlvbiB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgd2luID0gQXBwLmdldF93aW5kb3coXCJnZW9jbHVlLW1vZGFsXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdpbikgd2luLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAvLyBHZXQgUHJvcGVydHkgaGFuZGxlclxuICAgICAgICAgICAgICAgIChjb25uLCBzZW5kZXIsIG9iamVjdFBhdGgsIGludGVyZmFjZU5hbWUsIHByb3BlcnR5TmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlOYW1lID09PSBcIk1heEFjY3VyYWN5TGV2ZWxcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBHTGliLlZhcmlhbnQoXCJ1XCIsIDQpOyAvLyA0ID0gRXhhY3QgYWNjdXJhY3lcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIC8vIFNldCBQcm9wZXJ0eSBoYW5kbGVyXG4gICAgICAgICAgICAgICAgbnVsbFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gRmluZ2lhbW8gZGkgZXNzZXJlIGlsIGdlb2NsdWUtZGVtby1hZ2VudCBwZXIgYnlwYXNzYXJlIGxhIHdoaXRlbGlzdCBoYXJkY29kZWQgZGkgc2lzdGVtYVxuICAgICAgICAgICAgY29ubi5jYWxsKFxuICAgICAgICAgICAgICAgIFwib3JnLmZyZWVkZXNrdG9wLkdlb0NsdWUyXCIsXG4gICAgICAgICAgICAgICAgXCIvb3JnL2ZyZWVkZXNrdG9wL0dlb0NsdWUyL01hbmFnZXJcIixcbiAgICAgICAgICAgICAgICBcIm9yZy5mcmVlZGVza3RvcC5HZW9DbHVlMi5NYW5hZ2VyXCIsXG4gICAgICAgICAgICAgICAgXCJBZGRBZ2VudFwiLFxuICAgICAgICAgICAgICAgIG5ldyBHTGliLlZhcmlhbnQoXCIocylcIiwgW1wiZ2VvY2x1ZS1kZW1vLWFnZW50XCJdKSxcbiAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgIEdpby5EQnVzQ2FsbEZsYWdzLk5PTkUsXG4gICAgICAgICAgICAgICAgLTEsXG4gICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICAoY29ubiwgcmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25uLmNhbGxfZmluaXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIltHZW9jbHVlXSBBZ2VudCBuYXRpdmVseSBpbnRlZ3JhdGVkIGluIEFHUyFcIik7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbR2VvY2x1ZV0gQWRkQWdlbnQgZmFpbGVkICh3aGl0ZWxpc3QgaXNzdWU/KTogXCIgKyBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltHZW9jbHVlXSBCdXMgY29ubmVjdGlvbiBlcnJvcjogXCIgKyBlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gR2VvY2x1ZU1vZGFsKCkge1xuICAgIHJldHVybiBQb3B1cFdpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwiZ2VvY2x1ZS1tb2RhbFwiLFxuICAgICAgICBjaGlsZDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICBvcmllbnRhdGlvbjogR3RrLk9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcInBvbGtpdC1tb2RhbC1jb250YWluZXJcIl0sIFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoeyBcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiXHVEODNEXHVEQ0NEIEdlb2xvY2FsaXp6YXppb25lXCIsIFxuICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wicG9sa2l0LXRpdGxlXCJdIFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7IFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogYmluZChnZW9jbHVlUmVxdWVzdCkuYXMocmVxID0+IFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxID8gYEwnYXBwbGljYXppb25lIFwiJHtyZXEuYXBwfVwiIHN0YSByaWNoaWVkZW5kbyBsJ2FjY2Vzc28gYWxsYSB0dWEgcG9zaXppb25lIGdlb2dyYWZpY2EuXFxuQ29uc2VudGkgcXVlc3RhIGF6aW9uZT9gIDogXCJOZXNzdW5hIHJpY2hpZXN0YSBhdHRpdmEuXCJcbiAgICAgICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgICAgIGNzc19jbGFzc2VzOiBbXCJwb2xraXQtbXNnXCJdLCBcbiAgICAgICAgICAgICAgICAgICAgd3JhcDogdHJ1ZSBcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBXaWRnZXQuQm94KHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuICAgICAgICAgICAgICAgICAgICBzcGFjaW5nOiAxMixcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luX3RvcDogMTAsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogXCJcdTI3NEMgUmlmaXV0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhleHBhbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImdlb2NsdWUtYnRuLWRlbnlcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcSA9IGdlb2NsdWVSZXF1ZXN0LmdldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVxICYmIHJlcS5pbnZvY2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXEuaW52b2NhdGlvbi5yZXR1cm5fdmFsdWUobmV3IEdMaWIuVmFyaWFudChcIihiKVwiLCBbZmFsc2VdKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW9jbHVlUmVxdWVzdC5zZXQobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgd2luID0gQXBwLmdldF93aW5kb3coXCJnZW9jbHVlLW1vZGFsXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAod2luKSB3aW4udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkJ1dHRvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiXHUyNzA1IENvbnNlbnRpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiZ2VvY2x1ZS1idG4tYWxsb3dcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcSA9IGdlb2NsdWVSZXF1ZXN0LmdldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVxICYmIHJlcS5pbnZvY2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXEuaW52b2NhdGlvbi5yZXR1cm5fdmFsdWUobmV3IEdMaWIuVmFyaWFudChcIihiKVwiLCBbdHJ1ZV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdlb2NsdWVSZXF1ZXN0LnNldChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB3aW4gPSBBcHAuZ2V0X3dpbmRvdyhcImdlb2NsdWUtbW9kYWxcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh3aW4pIHdpbi52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pXG4gICAgfSlcbn1cbiIsICJpbXBvcnQgeyBBcHAsIEFzdGFsLCBHdGssIEdkaywgV2lkZ2V0IH0gZnJvbSBcImFzdGFsL2d0azRcIlxuaW1wb3J0IHsgVmFyaWFibGUsIEdMaWIsIGJpbmQsIGV4ZWNBc3luYyB9IGZyb20gXCJhc3RhbFwiXG5pbXBvcnQgR3JlZXQgZnJvbSBcImdpOi8vQXN0YWxHcmVldD92ZXJzaW9uPTAuMVwiXG5cbmNvbnN0IHBhc3N3b3JkID0gVmFyaWFibGUoXCJcIilcbmNvbnN0IGlzQXV0aGVudGljYXRpbmcgPSBWYXJpYWJsZShmYWxzZSlcbmNvbnN0IGVycm9yTWVzc2FnZSA9IFZhcmlhYmxlKFwiXCIpXG5cbmxldCBlbnRyeVdpZGdldDogYW55ID0gbnVsbFxuXG5HTGliLnVuaXhfc2lnbmFsX2FkZChHTGliLlBSSU9SSVRZX0RFRkFVTFQsIDE1LCAoKSA9PiB7XG4gICAgQXBwLnF1aXQoKVxuICAgIHJldHVybiBHTGliLlNPVVJDRV9SRU1PVkVcbn0pXG5cbmZ1bmN0aW9uIGRvTG9naW4oZW50cnk/OiBhbnkpIHtcbiAgICBpZiAoaXNBdXRoZW50aWNhdGluZy5nZXQoKSkgcmV0dXJuXG4gICAgY29uc3QgcGFzcyA9IHBhc3N3b3JkLmdldCgpXG4gICAgaWYgKCFwYXNzKSB7XG4gICAgICAgIGVycm9yTWVzc2FnZS5zZXQoXCJJbnNlcmlzY2kgbGEgcGFzc3dvcmRcIilcbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaXNBdXRoZW50aWNhdGluZy5zZXQodHJ1ZSlcbiAgICBlcnJvck1lc3NhZ2Uuc2V0KFwiVmVyaWZpY2EgY3JlZGVuemlhbGkuLi5cIilcblxuICAgIGNvbnN0IHJlc2V0VUkgPSAobXNnID0gXCJQYXNzd29yZCBlcnJhdGEuIFJpcHJvdmEuXCIpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNhbmNlbCA9IG5ldyBHcmVldC5DYW5jZWxTZXNzaW9uKClcbiAgICAgICAgICAgIGNhbmNlbC5zZW5kKCgpID0+IHt9KVxuICAgICAgICB9IGNhdGNoIChlKSB7fVxuXG4gICAgICAgIGlzQXV0aGVudGljYXRpbmcuc2V0KGZhbHNlKVxuICAgICAgICBwYXNzd29yZC5zZXQoXCJcIilcbiAgICAgICAgY29uc3QgdyA9IGVudHJ5IHx8IGVudHJ5V2lkZ2V0XG4gICAgICAgIGlmICh3KSB3LnRleHQgPSBcIlwiXG4gICAgICAgIGVycm9yTWVzc2FnZS5zZXQobXNnKVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHByZUNhbmNlbCA9IG5ldyBHcmVldC5DYW5jZWxTZXNzaW9uKClcbiAgICAgICAgcHJlQ2FuY2VsLnNlbmQoKCkgPT4ge1xuICAgICAgICAgICAgc3RhcnRBdXRoU2Vzc2lvbigpXG4gICAgICAgIH0pXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdGFydEF1dGhTZXNzaW9uKClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGFydEF1dGhTZXNzaW9uKCkge1xuICAgICAgICBjb25zdCByZXExID0gbmV3IEdyZWV0LkNyZWF0ZVNlc3Npb24oeyB1c2VybmFtZTogXCJlcm1ldGVcIiB9KVxuICAgICAgICByZXExLnNlbmQoKHMxLCByMSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbnMxID0gcmVxMS5zZW5kX2ZpbmlzaChyMSlcbiAgICAgICAgICAgICAgICBpZiAoYW5zMSBpbnN0YW5jZW9mIEdyZWV0LkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc2V0VUkoXCJFcnJvcmUgZGkgc2Vzc2lvbmUuIFJpcHJvdmEuXCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCByZXEyID0gbmV3IEdyZWV0LlBvc3RBdXRoTWVzc3NhZ2UoeyByZXNwb25zZTogcGFzcyB9KVxuICAgICAgICAgICAgICAgIHJlcTIuc2VuZCgoczIsIHIyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbnMyID0gcmVxMi5zZW5kX2ZpbmlzaChyMilcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbnMyIGluc3RhbmNlb2YgR3JlZXQuRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNldFVJKFwiUGFzc3dvcmQgZXJyYXRhLiBSaXByb3ZhLlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxMyA9IG5ldyBHcmVldC5TdGFydFNlc3Npb24oeyBjbWQ6IFtcIi9ldGMvZ3JlZXRkL2VybWV0ZS1zZXNzaW9uXCJdIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICByZXEzLnNlbmQoKHMzLCByMykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFuczMgPSByZXEzLnNlbmRfZmluaXNoKHIzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYW5zMyBpbnN0YW5jZW9mIEdyZWV0LkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNldFVJKFwiRXJyb3JlIGF2dmlvIHNlc3Npb25lLlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgR0xpYi5zcGF3bl9jb21tYW5kX2xpbmVfYXN5bmMoXCJraWxsYWxsIC05IG5pcmkgZ2pzIGFnc1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNldFVJKFwiRXJyb3JlIGF2dmlvIHNlc3Npb25lLlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc2V0VUkoXCJQYXNzd29yZCBlcnJhdGEuIFJpcHJvdmEuXCIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJlc2V0VUkoXCJFcnJvcmUgZGkgc2Vzc2lvbmUuIFJpcHJvdmEuXCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gR3JlZXRlcigpIHtcbiAgICByZXR1cm4gV2lkZ2V0LldpbmRvdyh7XG4gICAgICAgIG5hbWU6IFwiZ3JlZXRlclwiLFxuICAgICAgICBhcHBsaWNhdGlvbjogQXBwLFxuICAgICAgICBhbmNob3I6IEFzdGFsLldpbmRvd0FuY2hvci5UT1AgfCBBc3RhbC5XaW5kb3dBbmNob3IuQk9UVE9NIHwgQXN0YWwuV2luZG93QW5jaG9yLkxFRlQgfCBBc3RhbC5XaW5kb3dBbmNob3IuUklHSFQsXG4gICAgICAgIGV4Y2x1c2l2aXR5OiBBc3RhbC5FeGNsdXNpdml0eS5JR05PUkUsXG4gICAgICAgIGtleW1vZGU6IEFzdGFsLktleW1vZGUuRVhDTFVTSVZFLFxuICAgICAgICB2aXNpYmxlOiB0cnVlLFxuICAgICAgICBsYXllcjogQXN0YWwuTGF5ZXIuT1ZFUkxBWSxcbiAgICAgICAgY3NzX2NsYXNzZXM6IFtcImdyZWV0ZXItYmdcIl0sXG4gICAgICAgIGNoaWxkOiBXaWRnZXQuQ2VudGVyQm94KHtcbiAgICAgICAgICAgIGNlbnRlcldpZGdldDogV2lkZ2V0LkJveCh7XG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IEd0ay5PcmllbnRhdGlvbi5WRVJUSUNBTCxcbiAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiZ3JlZXRlci1ib3hcIl0sXG4gICAgICAgICAgICAgICAgdmFsaWduOiBHdGsuQWxpZ24uQ0VOVEVSLFxuICAgICAgICAgICAgICAgIGhhbGlnbjogR3RrLkFsaWduLkNFTlRFUixcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuTGFiZWwoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IFwiRXJtZXRlIE9TXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NfY2xhc3NlczogW1wiZ3JlZXRlci10aXRsZVwiXVxuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkxhYmVsKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBcIkVybWV0ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImdyZWV0ZXItdXNlclwiXVxuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgV2lkZ2V0LkVudHJ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyX3RleHQ6IFwiUGFzc3dvcmQgZGkgYWNjZXNzby4uLlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJpbGl0eTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZWQ6IChzZWxmKSA9PiBwYXNzd29yZC5zZXQoc2VsZi50ZXh0KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aXZhdGU6IChzZWxmKSA9PiBkb0xvZ2luKHNlbGYpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2Vuc2l0aXZlOiBiaW5kKGlzQXV0aGVudGljYXRpbmcpLmFzKGEgPT4gIWEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dXA6IChzZWxmKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cnlXaWRnZXQgPSBzZWxmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5ncmFiX2ZvY3VzKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldC5MYWJlbCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogYmluZChlcnJvck1lc3NhZ2UpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImdyZWV0ZXItZXJyb3JcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiBiaW5kKGVycm9yTWVzc2FnZSkuYXMoZSA9PiBlLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXQuQnV0dG9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBiaW5kKGlzQXV0aGVudGljYXRpbmcpLmFzKGEgPT4gYSA/IFwiQXV0ZW50aWNhemlvbmUgaW4gY29yc28uLi5cIiA6IFwiQWNjZWRpXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGlja2VkOiBkb0xvZ2luLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzX2NsYXNzZXM6IFtcImdyZWV0ZXItbG9naW4tYnRuXCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2Vuc2l0aXZlOiBiaW5kKGlzQXV0aGVudGljYXRpbmcpLmFzKGEgPT4gIWEpXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICB9KVxufVxuIiwgImltcG9ydCB7IEFwcCwgQXN0YWwsIEd0aywgR2RrLCBXaWRnZXQgfSBmcm9tIFwiYXN0YWwvZ3RrNFwiXG5pbXBvcnQgeyBHTGliIH0gZnJvbSBcImFzdGFsXCJcbmltcG9ydCB7IFBvcHVwV2luZG93LCB0aW1lU3RhdGUsIGRhdGVTdGF0ZSwgdXB0aW1lU3RhdGUsIGNwdVVzYWdlLCByYW1Vc2FnZSwgY2FmZmVpbmVTdGF0ZSwgd2lmaVN0YXRlLCBidFN0YXRlLCBpc1BsYXlpbmcsIG1lZGlhVHJhY2ssIG5pcmlXb3Jrc3BhY2VzLCB2b2xTdGF0ZSwgdm9sVmFsLCBtaWNWYWwsIGJyaWdodFZhbCwgYmF0dFN0YXRlLCBtZWRpYUFydGlzdCwgZGlza1VzYWdlLCB3aWZpRXhwYW5kZWQsIGJ0RXhwYW5kZWQsIHdpZmlMaXN0LCBidExpc3QsIGF1ZGlvU2lua3MsIGF1ZGlvU291cmNlcywgYXBwU3RyZWFtcywgZGVjb2RlciwgZXhlY1N5bmMsIGFsbE1vZGFscywgbGFzdEZvY3VzTG9zcywgdG9nZ2xlRXhjbHVzaXZlTW9kYWwsIHNjYW5XaWZpLCBzY2FuQnQsIHVwZGF0ZUF1ZGlvSHViLCBhdWRpb1RpbWVyLCBhcHBzU2VydmljZSwgcXVlcnlWYXIsIGFjdGl2ZUNhdGVnb3J5LCBsaXN0Ym94LCBDQVRFR09SWV9NQVAsIHVwZGF0ZUFwcExpc3QsIFN5c1RyYXkgfSBmcm9tIFwiLi9zdGF0ZVwiXG5pbXBvcnQgeyBOaXJpV29ya3NwYWNlcywgVG9wQmFyLCBXaWZpTW9kYWwsIEJ0TW9kYWwsIEF1ZGlvTW9kYWwsIFF1aWNrU2V0dGluZ3NNb2RhbCwgRXJtZXRlU2V0dGluZ3NNb2RhbCwgTWVkaWFQbGF5ZXJEb25nbGUsIFN5c01vbml0b3JEb25nbGUsIExhdW5jaGVyTW9kYWwsIGV2YWx1YXRlTWF0aCwgdXBkYXRlU3BvdGxpZ2h0TGlzdCwgU3BvdGxpZ2h0TW9kYWwsIFBvd2VyTWVudU1vZGFsLCBDYWxlbmRhck1vZGFsIH0gZnJvbSBcIi4vbW9kYWxzXCJcbmltcG9ydCB7IE5vdGlmaWNhdGlvblBvcHVwcyB9IGZyb20gXCIuL25vdGlmaWNhdGlvbnNcIlxuaW1wb3J0IHsgUG9sa2l0QWdlbnQsIFBvbGtpdE1vZGFsIH0gZnJvbSBcIi4vcG9sa2l0XCJcbmltcG9ydCB7IFVEaXNrc01vbml0b3IgfSBmcm9tIFwiLi91ZGlza3NcIlxuaW1wb3J0IHsgQ2xpcGJvYXJkTW9kYWwgfSBmcm9tIFwiLi9jbGlwYm9hcmRcIlxuaW1wb3J0IHsgR2VvY2x1ZU1vZGFsLCBpbml0R2VvY2x1ZUFnZW50IH0gZnJvbSBcIi4vZ2VvY2x1ZVwiXG5pbXBvcnQgeyBHcmVldGVyIH0gZnJvbSBcIi4vZ3JlZXRlclwiXG5pbXBvcnQgR0xpYiBmcm9tIFwiZ2k6Ly9HTGliXCJcblxuY29uc3QgaXNHcmVldGVyID0gISFHTGliLmdldGVudihcIkdSRUVURF9TT0NLXCIpXG5jb25zdCBkZWZhdWx0Q3NzID0gaXNHcmVldGVyID8gXCIvZXRjL3NrZWwvLmNvbmZpZy9hZ3Mvc3R5bGUvbWFpbi5jc3NcIiA6IGAke0dMaWIuZ2V0X2hvbWVfZGlyKCl9Ly5jb25maWcvYWdzL3N0eWxlLmNzc2BcblxuQXBwLnN0YXJ0KHtcbiAgICBjc3M6IGRlZmF1bHRDc3MsXG4gICAgbWFpbigpIHtcbiAgICAgICAgaWYgKGlzR3JlZXRlcikge1xuICAgICAgICAgICAgR3JlZXRlcigpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbmZpZ0RpciA9IEdMaWIuZ2V0X2hvbWVfZGlyKCkgKyBcIi8uY29uZmlnL2Fnc1wiXG4gICAgICAgIGNvbnN0IGNzc1BhdGggPSBjb25maWdEaXIgKyBcIi9zdHlsZS5jc3NcIlxuICAgICAgICBjb25zdCBzY3NzUGF0aCA9IGNvbmZpZ0RpciArIFwiL3N0eWxlL21haW4uc2Nzc1wiXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHNQYXRoID0gY29uZmlnRGlyICsgXCIvc3R5bGUvY29tcG9uZW50cy9ub3JtYWxcIlxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGV4ZWNTeW5jIH0gPSBpbXBvcnRzLmdpLkdMaWJcbiAgICAgICAgICAgIC8vIElmIHRoZSBzdHlsZSBkaXJlY3RvcnkgZXhpc3RzLCBjb21waWxlIHRoZSBtYWluIFNDU1MgZmlsZVxuICAgICAgICAgICAgaWYgKEdMaWIuZmlsZV90ZXN0KHNjc3NQYXRoLCBHTGliLkZpbGVUZXN0LkVYSVNUUykpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQ29tcGlsaW5nIFNDU1MgZnJvbSAke3Njc3NQYXRofWApXG4gICAgICAgICAgICAgICAgLy8gVXNlIEdMaWIuc3Bhd25fY29tbWFuZF9saW5lX3N5bmMgdG8gZXhlY3V0ZSB0aGUgc2FzcyBjb21tYW5kXG4gICAgICAgICAgICAgICAgR0xpYi5zcGF3bl9jb21tYW5kX2xpbmVfc3luYyhgc2FzcyAtLWxvYWQtcGF0aD1cIiR7Y29tcG9uZW50c1BhdGh9XCIgXCIke3Njc3NQYXRofVwiIFwiJHtjc3NQYXRofVwiYClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBjb21waWxlIFNDU1M6XCIsIGUpXG4gICAgICAgIH1cblxuICAgICAgICBBcHAuZ2V0X21vbml0b3JzKCkuZm9yRWFjaCgobW9uLCBpZHgpID0+IFRvcEJhcihtb24sIGlkeCkpXG4gICAgICAgIE5vdGlmaWNhdGlvblBvcHVwcygpXG4gICAgICAgIFdpZmlNb2RhbCgpXG4gICAgICAgIEJ0TW9kYWwoKVxuICAgICAgICBBdWRpb01vZGFsKClcbiAgICAgICAgUXVpY2tTZXR0aW5nc01vZGFsKClcbiAgICAgICAgRXJtZXRlU2V0dGluZ3NNb2RhbCgpXG4gICAgICAgIE1lZGlhUGxheWVyRG9uZ2xlKClcbiAgICAgICAgU3lzTW9uaXRvckRvbmdsZSgpXG4gICAgICAgIExhdW5jaGVyTW9kYWwoKVxuICAgICAgICBTcG90bGlnaHRNb2RhbCgpXG4gICAgICAgIFBvd2VyTWVudU1vZGFsKClcbiAgICAgICAgQ2FsZW5kYXJNb2RhbCgpXG4gICAgICAgIFBvbGtpdE1vZGFsKClcbiAgICAgICAgUG9sa2l0QWdlbnQoKVxuICAgICAgICBVRGlza3NNb25pdG9yKClcbiAgICAgICAgQ2xpcGJvYXJkTW9kYWwoKVxuICAgICAgICBHZW9jbHVlTW9kYWwoKVxuICAgICAgICBpbml0R2VvY2x1ZUFnZW50KClcblxuICAgICAgICBhbGxNb2RhbHMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdpbiA9IEFwcC5nZXRfd2luZG93KG5hbWUpXG4gICAgICAgICAgICBpZiAod2luKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2xvc2Ugb24gRVNDXG4gICAgICAgICAgICAgICAgY29uc3Qga2V5Q3RybCA9IG5ldyBHdGsuRXZlbnRDb250cm9sbGVyS2V5KClcbiAgICAgICAgICAgICAgICBrZXlDdHJsLmNvbm5lY3QoXCJrZXktcHJlc3NlZFwiLCAoY3RybCwga2V5dmFsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChrZXl2YWwgPT09IDY1MzA3KSB7IC8vIEdkay5LRVlfRXNjYXBlXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW4udmlzaWJsZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgd2luLmFkZF9jb250cm9sbGVyKGtleUN0cmwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgdXBkYXRlQXBwTGlzdCgpXG4gICAgICAgIHNjYW5XaWZpKClcbiAgICAgICAgc2NhbkJ0KClcbiAgICAgICAgdXBkYXRlQXVkaW9IdWIoKVxuICAgIH0sXG4gICAgcmVxdWVzdEhhbmRsZXIoYXJncywgcmVzKSB7XG4gICAgICAgIGNvbnN0IGNtZCA9IGFyZ3NbMF1cbiAgICAgICAgaWYgKGNtZCA9PT0gXCJ0b2dnbGVcIikge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gYXJnc1sxXSB8fCBcInF1aWNrLXNldHRpbmdzXCJcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbCA9IHRhcmdldCA9PT0gXCJjb250cm9sLWNlbnRlclwiID8gXCJxdWljay1zZXR0aW5nc1wiIDogdGFyZ2V0XG4gICAgICAgICAgICB0b2dnbGVFeGNsdXNpdmVNb2RhbChhY3R1YWwpXG4gICAgICAgICAgICByZXMoYFRvZ2dsZWQgJHthY3R1YWx9YClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyhcIlVua25vd24gY29tbWFuZFwiKVxuICAgICAgICB9XG4gICAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7QUFBQSxPQUFPQSxZQUFXO0FBQ2xCLE9BQU9DLFVBQVM7QUFDaEIsT0FBT0MsVUFBUzs7O0FDRmhCLE9BQU9DLFlBQVc7OztBQ0FYLElBQU0sV0FBVyxDQUFDLFFBQWdCLElBQ3BDLFFBQVEsbUJBQW1CLE9BQU8sRUFDbEMsV0FBVyxLQUFLLEdBQUcsRUFDbkIsWUFBWTtBQUVWLElBQU0sV0FBVyxDQUFDLFFBQWdCLElBQ3BDLFFBQVEsbUJBQW1CLE9BQU8sRUFDbEMsV0FBVyxLQUFLLEdBQUcsRUFDbkIsWUFBWTtBQWNWLElBQU0sVUFBTixNQUFNLFNBQWU7QUFB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SjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbIkFzdGFsIiwgIkd0ayIsICJHZGsiLCAiQXN0YWwiLCAiYmluZCIsICJpbnRlcnZhbCIsICJBc3RhbCIsICJBc3RhbCIsICJBc3RhbCIsICJ2IiwgImludGVydmFsIiwgIkd0ayIsICJBc3RhbCIsICJzbmFrZWlmeSIsICJwYXRjaCIsICJBcHAiLCAiR3RrIiwgIkFzdGFsIiwgIkFzdGFsIiwgIkd0ayIsICJHdGsiLCAiQXN0YWwiLCAiY2giLCAiZGVmYXVsdCIsICJBc3RhbCIsICJHT2JqZWN0IiwgImRlZmF1bHQiLCAiR09iamVjdCIsICJBc3RhbCIsICJHdGsiLCAiZGVmYXVsdCIsICJBc3RhbFdwIiwgImRlZmF1bHQiLCAiR3RrIiwgIkFzdGFsIiwgIkFzdGFsV3AiLCAiYXBwc1Njcm9sbCIsICJHdGsiLCAiQXN0YWwiLCAiZGVmYXVsdCIsICJBc3RhbCIsICJHdGsiLCAiR3RrIiwgIkdpbyIsICJHaW8iLCAiY29ubiIsICJkZWZhdWx0IiwgInJlcyIsICJHdGsiLCAiZGVmYXVsdCIsICJBc3RhbCIsICJHdGsiLCAiR0xpYiIsICJleGVjU3luYyIsICJHdGsiXQp9Cg==
