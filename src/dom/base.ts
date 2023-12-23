export type Action = () => void | Promise<void>;
export type Setter<T> = (newValue: T) => void | Promise<void>;
export type Getter<T> = () => T | Promise<T>;
export type Prop<T> = [Getter<T>, Setter<T>];
export type Fix = (callback: () => void | Promise<void>) => void;

export abstract class Dom {
    abstract fragment(): Node;

    abstract remove(): void;

    abstract feedModel(): Promise<void>;

    control(fix: Fix): void {
    }
}

export abstract class SingleNodeDom<N extends Node> extends Dom {
    constructor(protected readonly node: N) {
        super();
    }

    fragment() {
        return this.node;
    }

    remove() {
        removeMe(this.node);
    }
}

export class Txt extends SingleNodeDom<Text> {
    constructor(readonly get: Getter<string>) {
        super(document.createTextNode(""));
    }

    async feedModel() {
        const string = await this.get();
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}


function isElementInViewport (el: Element) {
    var rect = el.getBoundingClientRect();
    return (
        rect.top + rect.height + 200 >= 0 &&
        rect.left + rect.width + 200 >= 0 &&
        rect.bottom - rect.height - 200 <= (window.innerHeight || document.documentElement.clientHeight) && 
        rect.right - rect.width - 200 <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

export class Elem extends SingleNodeDom<Element> {
    private children: Dom[];
    constructor(tag: string, ...children : Dom[]) {
        super(document.createElement(tag));
        this.children = children;
        children.forEach(c => appendNode(this.node, c.fragment()));
    }
    
    async feedModel() {
        if(!isElementInViewport(this.node))
            return;
        await Promise.all(this.children.map(c => c.feedModel()));
    }

    control(fix: Fix) {
        this.children.forEach(c => c.control(fix));
    }
}

export class P<M> extends SingleNodeDom<HTMLParagraphElement>{
    constructor(readonly get: Getter<string>) {
        super(document.createElement("p"));
    }
    
    async feedModel() {
        const string = await this.get();
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}

export function labelled<M>(label: Getter<string>, value: Dom): Elem {
    return new Elem("div",
        new Txt(label),
        value
    );
}

export function constant<T>(value: T): Getter<T> {
    return () => value;
}

export function readonlyProp<T>(get: Getter<T>): Prop<T> {
    return [get, v => {return;}];
}

export function mapGet<T, U>(f: (x: T) => U): (get: Getter<T>) => Getter<U> {
    return get => async () => f(await get());
}

export function mapSet<T, U>(f: (x: U) => T): (set: Setter<T>) => Setter<U> {
    return set => x => set(f(x));
}

export function mapProp<T, U>(f: (x: T) => U, g: (y: U) => T): (prop: Prop<T>) => Prop<U> {
    return prop => [mapGet<T, U>(f)(prop[0]), mapSet<T, U>(g)(prop[1])];
}

export function mvc<M>(root: Dom): Promise<void> {
    root.control(async (callback) => {
        await callback();
        await root.feedModel();
        return;
    });
    // timeNow is the current time in milliseconds, created by
    // casting new Date() to a number with +
    var timeNow = +new Date();
    window.addEventListener('scroll', function() {
        // if the current time in milliseconds - timeNow is
        // less than 250, abort.
        if((+new Date() - timeNow) < 250) return;
        // Else, reset timeNow to now.
        timeNow = +new Date();
        root.feedModel();    
    });
    return root.feedModel();
}

export async function renderPage<M>(root: Dom): Promise<void> {
    return new Promise<void>( (resolve, reject) => {
        const go = mvc(root);
        if(document.body) {
            appendNode(document.body, root.fragment());
            resolve(go);
        }
        else {
            window.onload = async () => {
                appendNode(document.body,root.fragment());
                resolve(go);
            };
        }
    });
}

/// UTILITY
export function flatten<T>(xss: T[][]): T[] {
    return [].concat.apply([], xss);
}

// Slow! use map reduce if possible
export function foldl<A, B>(f: (b: B, a: A) => B, ac: B, xs: A[]): B {
    return (xs.length === 0) && ac || foldl(f, f(ac, xs[0]), xs.slice(1));
};

export function removeMe(node: Node) {
    if(node.parentElement)
        node.parentElement.removeChild(node);
}

export function appendNode<Child extends Node>(parent: Node, child: Child): Child {
    return parent.appendChild(child);
}