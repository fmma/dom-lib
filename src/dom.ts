type Action<M> = (model: M) => Promise<void>;
type Setter<M, T> = (newValue: T) => (model: M) => Promise<void>;
type Getter<M, T> = (model: M) => Promise<T>;
type Prop<M, T> = [Getter<M, T>, Setter<M, T>];
type Fix<M> = (callback: (m: M) => Promise<void>) => void;

abstract class Dom<M> {
    abstract fragment(): Node;

    abstract remove(): void;

    abstract feedModel(model: M): Promise<void>;

    control(fix: Fix<M>): void {
    }
}

abstract class SingleNodeDom<M, N extends Node> extends Dom<M> {
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

class Txt<M> extends SingleNodeDom<M, Text> {
    constructor(readonly get: Getter<M, string>) {
        super(document.createTextNode(""));
    }

    async feedModel(model: M) {
        const string = await this.get(model);
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }

    control(fix: Fix<M>) {
    }
}

class Elem<M> extends SingleNodeDom<M, Element> {
    private children: Dom<M>[];
    constructor(tag: string, ...children : Dom<M>[]) {
        super(document.createElement(tag));
        this.children = children;
        children.forEach(c => this.node.appendChild(c.fragment()));
    }
    
    async feedModel(model: M) {
        await Promise.all(this.children.map(c => c.feedModel(model)));
    }

    control(fix: Fix<M>) {
        this.children.forEach(c => c.control(fix));
    }
}

class P<M> extends SingleNodeDom<M, HTMLParagraphElement>{
    constructor(readonly get: Getter<M, string>) {
        super(document.createElement("p"));
    }
    
    async feedModel(model: M) {
        const string = await this.get(model);
        if(string !== this.node.textContent)
            this.node.textContent = string;
    }
}

class Table<M> extends SingleNodeDom<M, HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<M, string>;
    constructor(
        readonly cols: Getter<M, string[]>,
        readonly rows: Dom<M>[]) {
        super(document.createElement("table"));
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<M, string>(this.cols, () => new Elem("th", new Txt(get("1"))));
        this.thead.appendChild(this.theadCells.fragment());
        rows.forEach(row => this.tbody.appendChild(row.fragment()));
    }

    async feedModel(model: M) {
        this.theadCells.feedModel(model);
        this.rows.forEach(row => row.feedModel(model));
    }

    control(fix: Fix<M>) {
        this.theadCells.control(fix);
        this.rows.forEach(row => row.control(fix));
    }
}

class TableSmart<M, R> extends SingleNodeDom<M, HTMLTableElement>{
    thead : HTMLTableSectionElement;
    tbody : HTMLTableSectionElement;
    theadCells: ForEach<M, string>;
    tbodyRows: ForEach<M, R>;
    constructor(
        readonly cols: Getter<M, string[]>,
        readonly rows: Getter<M, R[]>,
        readonly row: () => Dom<[M, R]>[]) {
        super(document.createElement("table"));
        this.thead = this.node.appendChild(document.createElement("thead"));
        this.tbody = this.node.appendChild(document.createElement("tbody"));
        this.node.appendChild(this.thead);
        this.node.appendChild(this.tbody);
        this.theadCells = new ForEach<M, string>(cols, () => new Elem("th", new Txt(get("1"))));
        this.thead.appendChild(this.theadCells.fragment());

        const rowsPrime = () => new Elem<[M, R]>("tr", ...this.row().map(r => new Elem("td", r)));
        this.tbodyRows = new ForEach(this.rows, rowsPrime);
        this.tbody.appendChild(this.tbodyRows.fragment());
    }

    async feedModel(model: M) {
        this.theadCells.feedModel(model);
        this.tbodyRows.feedModel(model);
    }

    control(fix: Fix<M>) {
        this.theadCells.control(fix);
        this.tbodyRows.control(fix);
    }
}

function pagedTable<M, R>(
    cols: Getter<M, string[]>,
    rows: Getter<M, R[]>,
    row: () => Dom<[M, R]>[]): Elem<M> {
    let ps = 5;
    let p = 0;
    const div = new Elem("div"
        , new TableSmart(cols,
            async (m) => {
                const rs = await rows(m);
                return rs.slice(p, p + ps);
            },
            () => row())
        , new Txt(constant("page:"))
        , new Button(constant("prev"), async () => {
            if(p > 0)
                p = Math.max(0, p - ps);
          })
          , new InputNumber(constant("page"),   [ async () => Math.ceil(p / ps) + 1
                                                , y => async() => {p = (y - 1) * ps; return}
                                                ])
          , new Txt(async (m) => {
            const rs = await rows(m);
            return "/" + Math.ceil(rs.length / ps).toString() + " ";
          })
        , new Button(constant("next"), async (m) => {
            const rs = await rows(m);
            if(p + ps < rs.length)
                p = Math.min(p + ps, rs.length);
            return;
          })
        , new Txt(constant("page size:"))
        , new InputNumber(constant("page size"), [async () => ps, v => async () => {ps = v; return}])
        , new Txt(async (m) => {
          const rs = await rows(m);
          return "/" + Math.ceil(rs.length).toString() + " ";
        })
        );
    return div;
}


function labelled<M>(label: Getter<M, string>, value: Dom<M>): Elem<M> {
    return new Elem("div",
        new Txt(label),
        value
    );
}

function constant<M, T>(value: T): Getter<M, T> {
    return async () => value;
}

function get<M, K extends keyof M>(key: K): Getter<M, M[K]> {
    return async (m) => m[key];
}

function readonlyProp<M, T>(get: Getter<M, T>): Prop<M, T> {
    return [get, v => async (m) => {return;}];
}

function mapGet<M, T, U>(f: (x: T) => U): (get: Getter<M, T>) => Getter<M, U> {
    return get => async (m) => f(await get(m));
}

function getLens<M, T, U>(get: Getter<M, T>): (g: Getter<T, U>) => Getter<M, U> {
    return g => async (m) => g(await get(m));
}

function mapSet<M, T, U>(f: (x: U) => T): (set: Setter<M, T>) => Setter<M, U> {
    return set => x => async (m) => set(f(x))(m);
}

function setLens<M, T, U>(prop: Prop<M, T>): (s: Setter<T, U>) => Setter<M, U> {
    return s => u => async (m) => {
        const t = await prop[0](m); // get T from M
        await s(u)(t);              // set U in T
        await prop[1](t)(m);        // set T in M superfluous?
        return;
    }
}

function mapProp<M, T, U>(f: (x: T) => U, g: (y: U) => T): (prop: Prop<M, T>) => Prop<M, U> {
    return prop => [mapGet<M, T, U>(f)(prop[0]), mapSet<M, T, U>(g)(prop[1])];
}

function lens<M, T, U>(prop: Prop<M, T>): (prop: Prop<T, U>) => Prop<M, U> {
    return p => [getLens<M, T, U>(prop[0])(p[0]), setLens<M, T, U>(prop)(p[1])];
}

function set<M, K extends keyof M>(key: K): Setter<M, M[K]> {
    return x => async (m) => {
        m[key] = x; // TODO side-effecty
        return;
    }
}

function prop<M, K extends keyof M>(key: K): Prop<M, M[K]> {
    return [get(key), set(key)];
}

function mvc<M>(root: Dom<M>): (model: M) => Promise<void> {
    return async (model) => {
        root.control(async (callback) => {
            await callback(model);
            await root.feedModel(model);
            return;
        });
        return root.feedModel(model);
    }
}

async function renderPage<M>(root: Dom<M>, initialModel: Promise<M>): Promise<void> {
    return new Promise<void>( (resolve, reject) => {
        const go = mvc(root);
        window.onload = async () => {
            document.body.appendChild(root.fragment());
            resolve(go(await initialModel));
        };
    });
}

/// UTILITY
function flatten<T>(xss: T[][]): T[] {
    return [].concat.apply([], xss);
}

// Slow! use map reduce if possible
function foldl<A, B>(f: (b: B, a: A) => B, ac: B, xs: A[]): B {
    return (xs.length === 0) && ac || foldl(f, f(ac, xs[0]), xs.slice(1));
};

function insertMeBefore(node: Node, beforeNode: Node) {
    if(beforeNode.parentElement)
        beforeNode.parentElement.insertBefore(node, beforeNode);
}

function removeMe(node: Node) {
    if(node.parentElement)
        node.parentElement.removeChild(node);
}
