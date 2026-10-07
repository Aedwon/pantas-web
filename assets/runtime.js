/* Pantas site runtime: renders a page template with {{holes}} and <sc-if>
   blocks from a component class, and patches the DOM in place so running
   animations and typed form values survive re-renders. */
(function () {
  'use strict';
  var EVENTS = {
    onClick: ['click', true], onKeyDown: ['keydown', true], onInput: ['input', true],
    onChange: ['change', true], onSubmit: ['submit', true], onMouseEnter: ['mouseenter', false],
    onPointerEnter: ['pointerenter', false], onPointerLeave: ['pointerleave', false], onPointerMove: ['pointermove', true]
  };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  function lookup(vals, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, vals);
  }
  function whole(str) { var m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function interp(str, vals) {
    return str.replace(HOLE, function (_, p) { var v = lookup(vals, p); return v == null ? '' : String(v); });
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch, cb) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, next || {});
    if (this.__mount) this.__mount.render();
    if (cb) cb();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__mount) this.__mount.render(); };
  window.DCLogic = DCLogic;

  function build(node, vals, handlers) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      return document.createTextNode(t.indexOf('{{') < 0 ? t : interp(t, vals));
    }
    if (node.nodeType !== 1) return null;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-if') {
      var frag = document.createDocumentFragment();
      var p = whole(node.getAttribute('value') || '');
      if (p && lookup(vals, p)) {
        node.childNodes.forEach(function (c) { var n = build(c, vals, handlers); if (n) frag.appendChild(n); });
      }
      return frag;
    }
    var el = node.namespaceURI === 'http://www.w3.org/2000/svg'
      ? document.createElementNS(node.namespaceURI, node.tagName)
      : document.createElement(tag);
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i], name = a.name, val = a.value;
      if (name.indexOf('hint-') === 0) continue;
      var ev = null;
      for (var k in EVENTS) if (k.toLowerCase() === name.toLowerCase()) ev = k;
      if (ev) {
        var hp = whole(val);
        if (hp) { var id = handlers.length; handlers.push(lookup(vals, hp)); el.setAttribute('data-dc-' + EVENTS[ev][0], String(id)); }
        continue;
      }
      if (val.indexOf('{{') >= 0) {
        var w = whole(val);
        if (w) {
          var v = lookup(vals, w);
          if (v === false || v == null) continue;
          val = v === true ? '' : String(v);
        } else val = interp(val, vals);
      }
      try { el.setAttribute(name, val); } catch (e) { /* ignore invalid */ }
    }
    var src = tag === 'template' ? node.content : node;
    src.childNodes.forEach(function (c) { var n = build(c, vals, handlers); if (n) el.appendChild(n); });
    return el;
  }

  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.tagName !== b.tagName) return false;
    var ia = a.getAttribute('id'), ib = b.getAttribute('id');
    return ia === ib;
  }
  function mark(n) {
    if (n.nodeType === 3) { n.__dcText = n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    var m = {};
    for (var i = 0; i < n.attributes.length; i++) m[n.attributes[i].name] = n.attributes[i].value;
    n.__dcAttrs = m;
    n.childNodes.forEach(mark);
  }
  function syncAttrs(from, to) {
    var prev = from.__dcAttrs || {}, next = {};
    for (var j = 0; j < to.attributes.length; j++) next[to.attributes[j].name] = to.attributes[j].value;
    Object.keys(prev).forEach(function (n) { if (!(n in next)) from.removeAttribute(n); });
    Object.keys(next).forEach(function (n) { if (prev[n] !== next[n]) from.setAttribute(n, next[n]); });
    from.__dcAttrs = next;
  }
  function patch(parent, fresh) {
    var oldKids = Array.prototype.slice.call(parent.childNodes);
    var newKids = Array.prototype.slice.call(fresh.childNodes);
    var oi = 0;
    newKids.forEach(function (nk) {
      var ok = oldKids[oi];
      if (ok && sameNode(ok, nk)) {
        if (ok.nodeType === 1) { syncAttrs(ok, nk); patch(ok, nk); }
        else if (ok.nodeType === 3 && ok.__dcText !== nk.nodeValue) { ok.nodeValue = nk.nodeValue; ok.__dcText = nk.nodeValue; }
        oi++;
      } else {
        var match = -1;
        for (var s = oi + 1; s < oldKids.length && s < oi + 12; s++) {
          var c = oldKids[s];
          if (c.nodeType === 1 && sameNode(c, nk) && ((c.__dcAttrs || {})['class'] || '') === (nk.getAttribute('class') || '')) { match = s; break; }
        }
        if (match > 0) {
          for (var r = oi; r < match; r++) if (oldKids[r].parentNode === parent) parent.removeChild(oldKids[r]);
          oi = match;
          var o2 = oldKids[oi]; syncAttrs(o2, nk); patch(o2, nk); oi++;
        } else {
          mark(nk);
          parent.insertBefore(nk, ok && ok.parentNode === parent ? ok : null);
        }
      }
    });
    for (var x = oi; x < oldKids.length; x++) if (oldKids[x].parentNode === parent) parent.removeChild(oldKids[x]);
  }

  function wrap(e, el) {
    return {
      nativeEvent: e, type: e.type, target: e.target, currentTarget: el, key: e.key,
      clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType,
      preventDefault: function () { e.preventDefault(); }, stopPropagation: function () { e.stopPropagation(); }
    };
  }

  window.mountDC = function (Cls, tplEl, host) {
    var inst = new Cls({});
    var handlers = [];
    var rendering = false, again = false;
    var mount = {
      render: function () {
        if (rendering) { again = true; return; }
        rendering = true;
        do {
          again = false;
          var vals = inst.renderVals ? inst.renderVals() : {};
          handlers = [];
          var fresh = document.createElement('div');
          tplEl.content.childNodes.forEach(function (c) { var n = build(c, vals, handlers); if (n) fresh.appendChild(n); });
          if (!host.firstChild) { fresh.childNodes.forEach(mark); while (fresh.firstChild) host.appendChild(fresh.firstChild); }
          else patch(host, fresh);
        } while (again);
        rendering = false;
      }
    };
    inst.__mount = mount;
    Object.keys(EVENTS).forEach(function (k) {
      var type = EVENTS[k][0], bubbles = EVENTS[k][1];
      document.addEventListener(type, function (e) {
        var attr = 'data-dc-' + type, el = e.target;
        if (!bubbles) {
          if (!el || !el.getAttribute || !el.hasAttribute(attr)) return;
          var f0 = handlers[+el.getAttribute(attr)]; if (typeof f0 === 'function') f0(wrap(e, el));
          return;
        }
        while (el && el !== document) {
          if (el.getAttribute && el.hasAttribute(attr)) {
            var f = handlers[+el.getAttribute(attr)];
            if (typeof f === 'function') f(wrap(e, el));
            return;
          }
          el = el.parentNode;
        }
      }, !bubbles);
    });
    mount.render();
    if (inst.componentDidMount) inst.componentDidMount();
    return inst;
  };
})();
