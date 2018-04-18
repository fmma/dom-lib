class MyModel {
    n:number = 3;
    rows: MyRow[] = [
        {name: "bob", age: 10},
        {name: "august", age: 8}
    ]
    rowNames: string[] = [
        "name", "age"
    ]
    get nrows() {
        return this.rows.length;
    }
};

type MyRow = {
    name: string;
    age: number;
}

function example() {

    const view = new Elem<MyModel>("div",
        new P(async (m) => "HEJ:" + m.n.toString()),
        new InputNumber(constant("number"), get("n"), set("n")),
        new Button(constant("I'm a button"), set<MyModel, "n">("n")(0)),
        new Button(constant("Add row"), async (m) => {
            m.rows.push({name: "kim", age: 20});
            return m;
        }),
        new TableSmart(get("rowNames"), 
                       get("nrows"), () => [
                new P(async ([m, i]) => m.rows[i].name),
                new InputNumber(constant("age"), async ([m, i]) => m.rows[i].age, 
                                                (v) => async (m) => {
                                                    m[0].rows[m[1]].age = v;
                                                    return m;
                                                })]
        ),
        labelled(constant("Greater than 10?"), new Checkbox(async (m) => m.n > 10, (b) => async (m) => {
            m.n = b && m.n > 10 || !b && m.n < 10 ? m.n : 10;
            return m;
        }
        )),
        new ForEach(get("n"),
            () => new Elem("div", new ForEach(async (p) => p[1],
                () => new InputNumber(
                        constant("number"), 
                        get("1"),
                        v => async (m) => {
                            m[1] = v;
                            return m;
                        })))
    )
    );

    renderPage(view, Promise.resolve(new MyModel()));
}

example();