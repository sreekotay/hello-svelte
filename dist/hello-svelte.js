(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function claim_element(nodes, name, attributes, svg) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeName === name) {
                let j = 0;
                while (j < node.attributes.length) {
                    const attribute = node.attributes[j];
                    if (attributes[attribute.name]) {
                        j++;
                    }
                    else {
                        node.removeAttribute(attribute.name);
                    }
                }
                return nodes.splice(i, 1)[0];
            }
        }
        return svg ? svg_element(name) : element(name);
    }
    function claim_text(nodes, data) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeType === 3) {
                node.data = '' + data;
                return nodes.splice(i, 1)[0];
            }
        }
        return text(data);
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* hello.svelte generated by Svelte v3.22.2 */
    const file = "hello.svelte";
    const get_helloSlot_slot_changes = dirty => ({});
    const get_helloSlot_slot_context = ctx => ({});

    function create_fragment(ctx) {
    	let h3;
    	let a;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let current;
    	let dispose;
    	const helloSlot_slot_template = /*$$slots*/ ctx[5].helloSlot;
    	const helloSlot_slot = create_slot(helloSlot_slot_template, ctx, /*$$scope*/ ctx[4], get_helloSlot_slot_context);

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			a = element("a");
    			t0 = text("Hello");
    			t1 = space();
    			t2 = text(/*name*/ ctx[2]);
    			t3 = text(/*exclamation*/ ctx[0]);
    			t4 = space();
    			if (helloSlot_slot) helloSlot_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			h3 = claim_element(nodes, "H3", {});
    			var h3_nodes = children(h3);
    			a = claim_element(h3_nodes, "A", { href: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, "Hello");
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(h3_nodes);
    			t2 = claim_text(h3_nodes, /*name*/ ctx[2]);
    			t3 = claim_text(h3_nodes, /*exclamation*/ ctx[0]);
    			t4 = claim_space(h3_nodes);
    			if (helloSlot_slot) helloSlot_slot.l(h3_nodes);
    			h3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", "#");
    			add_location(a, file, 15, 4, 321);
    			add_location(h3, file, 15, 0, 317);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, a);
    			append_dev(a, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(h3, t4);

    			if (helloSlot_slot) {
    				helloSlot_slot.m(h3, null);
    			}

    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(a, "click", /*sayHello*/ ctx[1], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*exclamation*/ 1) set_data_dev(t3, /*exclamation*/ ctx[0]);

    			if (helloSlot_slot) {
    				if (helloSlot_slot.p && dirty & /*$$scope*/ 16) {
    					helloSlot_slot.p(get_slot_context(helloSlot_slot_template, ctx, /*$$scope*/ ctx[4], get_helloSlot_slot_context), get_slot_changes(helloSlot_slot_template, /*$$scope*/ ctx[4], dirty, get_helloSlot_slot_changes));
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(helloSlot_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(helloSlot_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (helloSlot_slot) helloSlot_slot.d(detaching);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

    	function sayHello() {
    		dispatch("helloMessage", { helloThing: "Hello!" });
    	}

    	let name = "world";
    	let { exclamation = ":)" } = $$props;
    	const writable_props = ["exclamation"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Hello> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Hello", $$slots, ['helloSlot']);

    	$$self.$set = $$props => {
    		if ("exclamation" in $$props) $$invalidate(0, exclamation = $$props.exclamation);
    		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		sayHello,
    		name,
    		exclamation
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("exclamation" in $$props) $$invalidate(0, exclamation = $$props.exclamation);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [exclamation, sayHello, name, dispatch, $$scope, $$slots];
    }

    class Hello extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { exclamation: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hello",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get exclamation() {
    		throw new Error("<Hello>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exclamation(value) {
    		throw new Error("<Hello>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* hello2.svelte generated by Svelte v3.22.2 */
    const file$1 = "hello2.svelte";
    const get_helloSlot_slot_changes$1 = dirty => ({});
    const get_helloSlot_slot_context$1 = ctx => ({});

    function create_fragment$1(ctx) {
    	let h3;
    	let a;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let current;
    	let dispose;
    	const helloSlot_slot_template = /*$$slots*/ ctx[5].helloSlot;
    	const helloSlot_slot = create_slot(helloSlot_slot_template, ctx, /*$$scope*/ ctx[4], get_helloSlot_slot_context$1);

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			a = element("a");
    			t0 = text("Hello2");
    			t1 = space();
    			t2 = text(/*name*/ ctx[2]);
    			t3 = text(/*exclamation*/ ctx[0]);
    			t4 = space();
    			if (helloSlot_slot) helloSlot_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			h3 = claim_element(nodes, "H3", {});
    			var h3_nodes = children(h3);
    			a = claim_element(h3_nodes, "A", { href: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, "Hello2");
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(h3_nodes);
    			t2 = claim_text(h3_nodes, /*name*/ ctx[2]);
    			t3 = claim_text(h3_nodes, /*exclamation*/ ctx[0]);
    			t4 = claim_space(h3_nodes);
    			if (helloSlot_slot) helloSlot_slot.l(h3_nodes);
    			h3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", "#");
    			add_location(a, file$1, 15, 4, 325);
    			add_location(h3, file$1, 15, 0, 321);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, a);
    			append_dev(a, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(h3, t3);
    			append_dev(h3, t4);

    			if (helloSlot_slot) {
    				helloSlot_slot.m(h3, null);
    			}

    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(a, "click", /*sayHello*/ ctx[1], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*exclamation*/ 1) set_data_dev(t3, /*exclamation*/ ctx[0]);

    			if (helloSlot_slot) {
    				if (helloSlot_slot.p && dirty & /*$$scope*/ 16) {
    					helloSlot_slot.p(get_slot_context(helloSlot_slot_template, ctx, /*$$scope*/ ctx[4], get_helloSlot_slot_context$1), get_slot_changes(helloSlot_slot_template, /*$$scope*/ ctx[4], dirty, get_helloSlot_slot_changes$1));
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(helloSlot_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(helloSlot_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (helloSlot_slot) helloSlot_slot.d(detaching);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

    	function sayHello() {
    		dispatch("hello2-Message", { helloThing: "Hello2!" });
    	}

    	let name = "world";
    	let { exclamation = ":)" } = $$props;
    	const writable_props = ["exclamation"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Hello2> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Hello2", $$slots, ['helloSlot']);

    	$$self.$set = $$props => {
    		if ("exclamation" in $$props) $$invalidate(0, exclamation = $$props.exclamation);
    		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		sayHello,
    		name,
    		exclamation
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("exclamation" in $$props) $$invalidate(0, exclamation = $$props.exclamation);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [exclamation, sayHello, name, dispatch, $$scope, $$slots];
    }

    class Hello2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { exclamation: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hello2",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get exclamation() {
    		throw new Error("<Hello2>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exclamation(value) {
    		throw new Error("<Hello2>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* old way
    new Hello({
      target: document.querySelector('#hello')
    })
    */

    // exported to global space
    window.Hello = (opts) => new Hello(opts);
    window.Hello2 = (opts) => new Hello2(opts);

}());
