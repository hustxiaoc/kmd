var UglifyJS = require("uglify-js"),
    fs = require("fs"),
    tool = require("./parser/tool"),
    log = tool.log,
    path = require("path"),
    _ = require("underscore"),
    pkgConfig = null;


function getDependency(code){
    var dependencies = [];
    if(!code) {
        return dependencies;
    }

    UglifyJS.parse(code)
    .walk(new UglifyJS.TreeWalker(function(node, descend) {
        if( node instanceof UglifyJS.AST_Call) {
            if(node.start.value == 'require') {
                if(node.args && node.args.length == 1) {
                    var module = node.args[0].value && node.args[0].value.trim();

                    if(!module || (node.expression &&node.expression.expression)) {
                        //剔除require("./storage").alloc("udata") 这种情况
                        return;
                    }
                    dependencies.push(module);
                }
            }
        }
    }));
    return dependencies;
}


module.exports = {
    getDependency:getDependency,
    wrap:tool.wrapKISSY,
    minify:tool.minify
}
