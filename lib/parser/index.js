var UglifyJS = require("uglify-js"),
    fs = require("fs"),
    tool = require("./tool"),
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
                    var module = node.args[0].value.trim();
                    dependencies.push(module);
                }
            }
        }
    }));
    return dependencies;
}


function parse(filePath) {
    var code = fs.readFileSync(filePath);

    return {
        dependencies:getDependency(code),
        minify: tool.minify(code);
    }
}
module.exports = {
    parse:parse
}
