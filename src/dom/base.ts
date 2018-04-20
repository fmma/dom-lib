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

export class Elem extends SingleNodeDom<Element> {
    private children: Dom[];
    constructor(tag: string, ...children : Dom[]) {
        super(document.createElement(tag));
        this.children = children;
        children.forEach(c => this.node.appendChild(c.fragment()));
    }
    
    async feedModel() {
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
    return root.feedModel();
}

export async function renderPage<M>(root: Dom): Promise<void> {
    return new Promise<void>( (resolve, reject) => {
        const go = mvc(root);
        if(document.body) {
            document.body.appendChild(root.fragment());
            resolve(go);
        }
        else {
            window.onload = async () => {
                document.body.appendChild(root.fragment());
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

export function insertMeBefore(node: Node, beforeNode: Node) {
    if(beforeNode.parentElement)
        beforeNode.parentElement.insertBefore(node, beforeNode);
}

export function removeMe(node: Node) {
    if(node.parentElement)
        node.parentElement.removeChild(node);
}
