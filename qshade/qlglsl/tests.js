

const runQLGLSLTests = (() => {
        
    function shouldFail(test) {
        return { negative: true, test: test };
    }

    function inFunction(test) {
        return `void main() { ${test} }`;
    }

    const QLGLSL_TESTS = {
        precision: {
            basic: `precision mediump float;`
        },
        
        variable_definition: {
            root_level: {
                with_value: {
                    with_uniform: `uniform float x = 3.0;`,
                    with_const: `const float x = 3.0;`,
                    with_varying: `varying float x = 3.0;`,
                    without_qualifier: `float x = 3.0;`,
                },
                without_value: {
                    with_uniform: `uniform float x;`,
                    with_const: `const float x;`,
                    with_varying: `varying float x;`,
                    without_qualifier: `float x;`,
                },
                only_accepts_basic_assign: shouldFail(`float x += 3.0;`)
            },

            function_level: {
                with_qualifier: shouldFail(inFunction(`uniform float x = 3.0;`)),
                without_value: `float x;`,
                with_value: `float x = 3.0;`,
                only_accepts_basic_assign: shouldFail(`float x += 3.0;`)
            }
        },

        variable_assign: {
            with_basic_assign: inFunction(`x = 3.0;`),
            with_operator_assign: inFunction(`x += 3.0;`)
        },

        property_assign: {
            with_basic_assign: inFunction(`x.y = 3.0;`),
            with_operator_assign: inFunction(`x.z += 3.0;`),
            complex_access_assign: inFunction(`(1 + 2).x().y = 1;`)
        },

        function_definition: {
            without_args_without_body: `void main() {}`,
            with_one_arg_without_body: `void main(int x) {}`,
            with_args_without_body: `void main(int x, int y, int z) {}`,
            without_args_with_body: `void main() { x = 3.0; y = 1.0; }`,
            with_args_with_body: `void main(int x, int y, int z) { x = 3.0; y = 1.0; }`
        },

        if_statement: {
            only_if_without_body: inFunction(`if (x > 3) {}`),
            only_if_with_body: inFunction(`if (x > 3) { x = 2.0; y = 3.0; }`),
            if_and_else: inFunction(`if (x > 3) {} else {}`),
            if_and_else_with_body: inFunction(`if (x > 3) { x = 2.0; y = 3.0; } else { x = 2.0; y = 3.0; }`),
            if_and_elseifs: inFunction(`if (x > 3) {} else if (x > 2) {} else if (x > 1) {}`),
            if_and_elseifs_with_body: inFunction(`if (x > 3) { x = 2.0; y = 3.0; } else if (x > 2) { x = 2.0; y = 3.0; } else if (x > 1) { x = 2.0; y = 3.0; }`),
            if_and_elseifs_and_else: inFunction(`if (x > 3) {} else if (x > 2) {} else if (x > 1) {} else {}`),
            if_and_elseifs_and_else_with_body: 
                inFunction(`if (x > 3) { x = 2.0; y = 3.0; } else if (x > 2) { x = 2.0; y = 3.0; } else if (x > 1) { x = 2.0; y = 3.0; } else { x = 2.0; y = 3.0; }`)
        },

        for_statement: {
            empty_conditions: inFunction(`for (;;) {}`),
            basic_conditions: inFunction(`for (int i = 1; i < 3; i++) {}`),
            empty_conditions_with_body: inFunction(`for (;;) { x = 2.0; y = 4.0; }`)
        },

        return_statement: {
            basic: inFunction(`return 3;`)
        },

        basic_values: {
            float: `float x = 3.0;`,
            int: 'int x = 3;',
            variable: 'int x = y;'
        },

        function_call: {
            without_args: `float x = example();`,
            with_one_arg: `float x = example(3);`,
            with_multi_args: `float x = example(1, 2, 3);`,
            with_property_access: `float x = obj.example(1, 2, 3);`
        },

        property_access: {
            single_property: `float x = obj.x;`,
            multi_property: `float x = obj.x.y.z;`,
            complex_expression_property: `float x = obj(1, 2).x.y;`
        },

        binary_operator: {
            single_operation: `float x = 1 + 2;`,
            multiple_operations: `float x = 1 + 2 + 3;`,
            multiple_operation_types: `float x = 1 * 2 + 3 * 4 + 5;`
        },

        unary_operator: {
            negative_operator: `float x = -1;`,
            positive_operator: `float x = +1;`,
            bool_negative_operator: `float x = !y;`,
        },

        crement: {
            increment_prefix: `float x = ++i;`,
            increment_suffix: `float x = i++;`,
            decrement_prefix: `float x = --i;`,
            decrement_suffix: `float x = i--;`,
            increment_prefix_property: `float x = obj.i++;`,
            increment_suffix_property: `float x = ++obj.i;`
        },

        bracketed: {
            bracketed_operation: `float x = (1 + 2) + 3;`,
            bracketed_function_call: `float x = (1 + 2)(1, 2);`,
            bracketed_property: `float x = (x + y).z;`
        }
    };

    function runTest(compile, test) {
        const isNegative = !!test.negative;
        if (isNegative) {
            test = test.test;
        }

        let passed = true;
        try {
            const result = compile(test);
            passed = !!result;
        } catch(e) {
            passed = false;
        }

        if (isNegative) {
            return !passed;
        }
        return passed;
    }

    function runTests(compile, tests, prefix) {
        let failures = 0;
        Object.keys(tests).forEach((name) => {
            const value = tests[name];
            if (isString(value) || value.negative) {
                const result = runTest(compile, value);
                if (!result) {
                    failures++;
                }
                console.log(`${prefix}${name}${result ? '' : ': FAIL'}`);
            } else {
                console.log(`${prefix}${name}:`);
                failures += runTests(compile, value, prefix + '|  ');
            }
        });
        return failures;
    }

    return (compile) => {
        const failures = runTests(compile, QLGLSL_TESTS, ''); 
        console.log(`there were ${failures} failures`);
    };
})();