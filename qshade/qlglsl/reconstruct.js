

const QLGLSLReconstruct = (() => {
    function reconstructBody(body) {
        lines = body.map(reconstruct).map((s) => s.split('\n')).flat();
        return '    ' + lines.join('\n    ');
    }

    const nodemap = {
        precision: (node) => `precision ${node.precision} ${node.type};`,
        variable_definition: (node, ctx) => `${node.qualifier ? node.qualifier + ' ' : ''}${node.type} ${node.name}${node.value ? ' = ' + reconstruct(node.value) : ''}${ctx.simpleStatement ? '' : ';'}`,
        variable_assign: (node, ctx) => `${node.name} ${node.assign} ${reconstruct(node.value)}${ctx.simpleStatement ? '' : ';'}`,
        property_assign: (node, ctx) => `${reconstruct(node.property)} ${node.assign} ${reconstruct(node.value)}${ctx.simpleStatement ? '' : ';'}`,
        value_statement: (node) => reconstruct(node.value),
        empty_statement: () => '',
        function_definition: (node) => {
            const args = node.args.types.map((type, i) => `${type} ${node.args.names[i]}`).join(', ');
            return `${node.returnType} ${node.name}(${args}) {\n${reconstructBody(node.body)}\n}`;
        },
        if: (node) => {
            let str = `if (${reconstruct(node.condition)}) {\n${reconstructBody(node.body)}\n}`;
            node.elseif.conditions.forEach((condition, i) => {
                str += ` else if (${reconstruct(condition)}) {\n${reconstructBody(node.elseif.bodies[i])}\n}`;
            });
            if (node.else) {
                str += ` else {\n${reconstructBody(node.else)}\n}`;
            }
            return str;
        },
        for: (node) => {
            const ctx = { simpleStatement: true };
            return `for (${reconstruct(node.initialize, ctx)}; ${reconstruct(node.check, ctx)}; ${reconstruct(node.increment, ctx)}) {\n${reconstructBody(node.body)}\n}`;
        },
        return: (node) => `return ${reconstruct(node.value)};`,
        break: (node) => `break;`,
        float: (node) => node.value,
        int: (node) => node.value,
        variable: (node) => node.value,
        bracketed: (node) => `(${reconstruct(node.value)})`,
        unary: (node) => `${node.operator}${reconstruct(node.value)}`,
        function_call: (node) => `${reconstruct(node.value)}(${node.args.map(reconstruct).join(', ')})`,
        binop: (node) => reconstruct(node.values[0]) + node.ops.map((op, i) => ` ${op} ${reconstruct(node.values[i + 1])}`).join(''),
        property_access: (node) => `${reconstruct(node.value)}.${node.property}`,
        crement: (node) => `${node.suffix ? '' : node.operator}${reconstruct(node.value)}${node.suffix ? node.operator : ''}`,
        chunk: (node) => `${node.chunk}`
    };

    function reconstruct(node, ctx) {
        const mapper = nodemap[node.nodetype];
        if (!mapper) {
            console.log('no mapper found for nodetype ' + node.nodetype)
        } 
        return nodemap[node.nodetype](node, ctx);
    }

    return (nodelist) => {
        return nodelist.map(reconstruct).join('\n');
    };
})();