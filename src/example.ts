class MyModel {
    n:number = 3;
    rows: MyRow[] = [
        {name: "bob", age: 10},
        {name: "august", age: 8},
        {name: "finn", age: 54},
        {name: "klaus", age: 12},
        {name: "bert", age: 32},
        {name: "fillipa", age: 42},
        {name: "emma", age: 13},
        {name: "ava", age: 81}
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

    const rowFun: () => Dom<[MyModel, MyRow]>[] = () => [
        new P(getLens<[MyModel, MyRow], MyRow, string>(get("1"))(get("name"))),
        new InputText(constant("name"), lens<[MyModel, MyRow], MyRow, string>(prop("1"))(prop("name"))),
        new InputNumber(constant("age"), [ async (m) => m[1].age
                                         , a => async (m) => {
                                             ageSum += a - m[1].age; console.log("agediff", a - m[1].age); m[1].age = a; return m
                                           }
                                         ]),
        new Button(constant("delete"), async (m) => {
            console.log("agediff", -m[1].age);
            ageSum += -m[1].age;
            m[0].rows.splice(m[0].rows.indexOf(m[1]), 1); 
            return m;
        })
        ]

    let ageSum = new MyModel().rows.map(r => r.age).reduce((a, b) => a+b);
    const view = new Elem<MyModel>("div",
        new P(getLens<MyModel, MyRow[], string>(get("rows"))(async (r) => {return r.map(r => r.age).reduce((a, b) => a + b, 0).toString()})),
        new P(async (m) => ageSum.toString()),
        new InputNumber(constant("number"), prop("n")),
        new Button(constant("I'm a button"), set<MyModel, "n">("n")(0)),
        new Button(constant("Add row"), async (m) => {
            for(let i = 0; i < 10000; ++i) {
                const age = Math.round(Math.random() * 100);
                console.log("agediff", age);
                ageSum += age;
                m.rows.push({name: "kim", age: age });
            }
            return m;
        }),
        labelled(constant("Greater than 10?"), new Checkbox(async (m) => m.n > 10, (b) => async (m) => {
            m.n = b && m.n > 10 || !b && m.n < 10 ? m.n : 10;
            return m;
        })),
        pagedTable(get("rowNames"), get("rows"), rowFun),
        pagedTable(get("rowNames"), get("rows"), rowFun),
        // new TableSmart(get("rowNames"), get("rows"), rowFun)
    );

    renderPage(view, Promise.resolve(new MyModel()));
}

example();