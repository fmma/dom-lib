import { Dom, P, InputText, InputNumber, pagedTable, renderPage, Button, TableSmart, labelled, Checkbox, Elem, Prop } from './dom';

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
    colNames: string[] = [
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
    const model = new MyModel();
    const rowFun: (getRow: () => MyRow) => Dom[] = (getRow) => [
        new P(() => getRow().name),
        new InputText(() => "name", [() => getRow().name, n => {getRow().name = n}]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a; 
                                             return;
                                           }
                                         ]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a; 
                                             return;
                                           }
                                         ]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a;
                                             return;
                                           }
                                         ]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a; 
                                             return;
                                           }
                                         ]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a; 
                                             return;
                                           }
                                         ]),
        new InputNumber(() => "age", [ () => getRow().age
                                         , a => {
                                             ageSum += a - getRow().age; 
                                             // console.log("agediff", a - getRow().age); 
                                             getRow().age = a; 
                                             return;
                                           }
                                         ]),
        new Button(() => ("delete"), () => {
            // console.log("agediff", -getRow().age);
            ageSum += -getRow().age;
            model.rows.splice(model.rows.indexOf(getRow()), 1); 
            return;
        })
        ]

    let ageSum = model.rows.map(r => r.age).reduce((a, b) => a+b);
    const view = new Elem("div",
        new P(() => ageSum.toString()),
        new InputNumber(() => "number", [() => model.n, (n0) => {model.n = n0}]),
        new Button(() => "I'm a button", () => {model.n = 0}),
        new Button(() => "Add rows", () => {
            for(let i = 0; i < 1000; ++i) {
                const age = Math.round(Math.random() * 100);
                // console.log("agediff", age);
                ageSum += age;
                model.rows.push({name: "kim", age: age });
            }
            return;
        }),
        labelled(() => ("Greater than 10?"), new Checkbox(
            () => model.n > 10, 
            b => {
                model.n = b && model.n > 10 ||
                         !b && model.n < 10 
                         ? model.n
                         : 10;
                return;
            })),
        pagedTable(() => model.colNames, () => model.rows, rowFun),
        pagedTable(() => model.colNames, () => model.rows, rowFun),
        //  new TableSmart(() => model.colNames, () => model.rows, rowFun)
    );
    renderPage(view);
}

example();