

const QLGLSLNodeWalker = (() => {
    function isNode(obj) {
        return !!obj.nodetype;
    }

    function visit(node, visitor) {
        if (visitor[node.nodetype]) {
            let result = visitor[node.nodetype](node);
            if (result) {
                return result;
            }
        }

        Object.keys(node).forEach((key) => {
            let child = node[key];
            if (isNode(child)) {
                node[key] = visit(child, visitor);
            } else if (child.length && isNode(child[0])) {
                node[key] = child.map((childNode) => visit(childNode, visitor));
            }
        });

        return node;
    }

    return (nodelist, visitor) => {
        return nodelist.map((node) => visit(node, visitor));
    };
})();