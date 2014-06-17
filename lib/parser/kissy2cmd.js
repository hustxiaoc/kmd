var tool = require('./tool'),
    log = tool.log,
    util = require("util"),
    path = require("path"),
    fs = require("fs"),
    UglifyJS = require("uglify-js"),
    walk = require('walk'),
    _ = require("underscore");

var reCommentRecover = /\/\*\$comment(\d+)\$\*\//g;
    reKISSY = /(?:KISSY|S)[\r\n\s]*\.[\r\n\s]*add/,

    specialString = [
       [ /'\/\/'/g , '"//"' ]
    ];


function Parser(source, options) {
    this.source = source;
    this.options = options || {};
    this.init();
}


Parser.prototype = {
    init: function() {
        this.parsedCode = [];
        this.comments  = {};
        this.moduleName = "";
        this.args = [];
        this.requires = [];
        if(this.preParser()){
            this.parse();
        }

    },

    pushCode: function(code) {
        this.parsedCode.push(code);
        return this;
    },

    parseComment: function() {
        var self = this;
        return tool.stripComment(this.source, function(comment) {
                    var id = Math.random().toString().split(".")[1] + Date.now();
                    self.comments[id] = comment;
                    self.source = self.source.replace(comment,util.format('/*$comment%s$*/',id));
               });
    },

    recoverComment: function() {
        var self = this;
        this.source = this.source.replace(reCommentRecover, function(match, id) {
            if(self.comments[id]) {
                return self.comments[id];
            }
            return match;
        });
        return this;
    },

    preParser: function() {
        var self = this;

        var code = this.source;

        specialString.forEach(function(item) {
            self.source = self.source.replace(item[0],item[1]);
        });

        var source = this.parseComment()

        var _source = source.trim().replace(/;/g,"");
        var search = _source.search(reKISSY);
        if(search !== 0) {

            // if(search > 0) {
            //     _source = _source.substring(0,search).trim();
            //     var last = _source.substr(_source.length-1,1);
            //     _source = _source.substring(0, _source.length-1);

            //     var isCall = false;

            //     if(last == "'" || last == '"') {
            //         for(var i=0 ;i<_source.length;i++) {
            //             if(_source[i] == last) {
            //                 isCall = !isCall;
            //             }
            //         }
            //     }else{
            //         isCall = true;
            //     }
            //     if(isCall) {
            //         if(self.options.file.indexOf("coverage")<0){
            //             warn("Invalid KISSY Module !\n\t%s",self.options.file||"");
            //         }

            //     }
            // }

            this.source = code;
            return false;
        }
        if(self.options.minify) {
            this.source =source;
        }

        return true;
    },

    parse: function() {
        var self = this,
            source = this.source;

        if(this.source.search(reKISSY) == -1){
            return this.end();
        }

        try{
            tool.parseCode(source, function(node) {
                if( node instanceof UglifyJS.AST_Call){

                      if(tool.isCallKISSYAdd(node)) {
                          var root = this.find_parent(UglifyJS.AST_Call);

                          if(root && root !== node){
                              //查找最外层的KISSY.ADD;
                              var isDescend = this.stack.some(function(_node){
                                 return _node !== node && tool.isCallKISSYAdd(_node);
                              });
                              if(isDescend){
                                  return true;
                              }

                          }else{
                              //当前已经进入最外层
                              if(!tool.stripComment(source.replace(source.substring(node.start.pos, node.end.endpos),"")).trim().replace(/;/g,"").trim()) {
                                  self.parseNode(node);
                              }
                          }
                      }
                }
            });
        }  catch(err){
            if(self.options.file) {
                err = util.format("file:%s\n%s",self.options.file, err);
            }
            log.error(err);
            self.pushCode(source);
        }

        return this;
    },

    parseNode: function(node) {
        var self = this,
            source = this.source,
            factory,
            deps,
            args = node.args,
            len = args.length,

            requires,
            argsName = [],
            mainCode = [];

        self.pushCode(source.substring(0,node.start.pos).trimRight()+'\n');

        if(len ==1) {
            // factory
            factory =args[0];
        }
        if(len == 2) {
            // factory,deps

            factory = args[0];
            deps =  args[len-1];

            if(factory.start.type == "string") {
                self.moduleName = factory.start.value;
                factory = deps;
                deps = null;
            }

        }
        if(args.length == 3) {
            // name,factory,deps
            self.moduleName = args[0].value;
            factory = args[1];
            deps = args[len-1];


        }

        if(deps) {
            requires = source.substring(deps.start.pos,deps.end.pos+1);
        }

        if(factory.start.type == "keyword" && factory.start.value == "function") {

            if(factory.argnames && factory.argnames.length) {
                factory.argnames.forEach(function(arg) {
                    argsName.push(arg.name);
                });
            }

            var _code = [];
            if(requires) {
                argsName = argsName.splice(1);

                requires = requires.substring(requires.indexOf("[")+1, requires.indexOf("]")).split(",").map(function(item) {
                                  return tool.stripQuote(item);
                               });

                self.requires = requires;
                requires.forEach(function(require, index) {
                    if(!require) {
                        return;
                    }
                    if(argsName && argsName[index]) {
                        _code.push(util.format("\tvar %s = require('%s');", argsName[index], require));
                    }else {
                        _code.push(util.format("\trequire('%s');",require));
                    }
                });

                if(_code.length) {
                    _code = _code.join("\n") ;
                    mainCode.push(_code);
                }
            }




            if(factory.body && factory.body.length) {

                factory.body.forEach(function(body) {
                    if (body.start.type == "keyword" && body.start.value == "return") {
                        mainCode.push("\n\tmodule.exports = " + source.substring(body.start.endpos, body.end.endpos));
                    }else{
                        mainCode.push("\t"+source.substring(body.start.pos, body.end.endpos).trimLeft());
                    }
                });

            }
        }else{
            //factory 不是构造函数
            mainCode.push("\tmodule.exports = " + source.substring(factory.start.pos, factory.end.endpos));
        }


        var code = mainCode.join("\n");

        if(code.search(/'use\s+strict'[\r\n\s]*;/) > -1) {
            code = "\t'use strict';\n" + code.replace(/'use\s+strict'[\r\n\s]*;/,"");

        }
        if(self.options.minify) {
            code = tool.minify(code);
        }

        if(self.options.style == "kissy") {
            self.pushCode(tool.wrapKISSY(code, {
                minify:self.options.minify,
                moduleName: self.options.pkg ||self.moduleName
            }));
        }else{
            self.pushCode(code);
        }

        self.pushCode(source.substring(node.end.endpos+1));

        self.end();
    },

    end: function() {
        var self = this;
        this.source = this.parsedCode.join("\n");
        this.recoverComment();
        this.source = this.source.trim();
        if(this.options.style != "kissy") {
            this.source = "\t" + this.source;
        }
        this.comments = {};
    },

};


var defaultOptions = {
    fromString: false,
    ignoreFiles: '-min.js',
    filters: /[\/]+\.\w+/
}

function build(options) {
    var options = _.extend({},defaultOptions, options),
        sourcePath = options.src,
        buildPath = options.dest;


    options.filters = tool.makeArray(options.filters);
    options.ignoreFiles = tool.makeArray(options.ignoreFiles);

    walk.walk(sourcePath, {
                    followLinks: false,
                    filters: options.filters
                 }
        )
        .on("file", function (root, fileStats, next) {
            var file = path.join(root,fileStats.name);
            var relative = file.replace(sourcePath,"").trim();

            var ignore = options.ignoreFiles && options.ignoreFiles.some(function (filter) {
              if (fileStats.name.match(filter)) {
                return true;
              }
            });

            if(ignore) {
                return next();
            }
            if(relative ) {
                var content = fs.readFileSync(file).toString(),
                    buildFile = path.join(buildPath,relative),
                    dirpath = path.dirname(buildFile);

                if(path.extname(file) == ".js") {
                    options.file = file;
                    content = new Parser(content, options).source;
                }
                if(options.stdout) {
                    log.info("building ",file);
                }


                tool.write(buildFile, content);
                if(options.stdout) {
                    log.info("%s is build successfully!", relative);
                }
            }
            next();
        }).on("end", function() {
            log.info("build done!");
        })


}


module.exports = {
    parse:function(input,options) {
       var options = _.extend({}, defaultOptions, options),
           code = input;

       if(!options.fromString) {
           if(fs.existsSync(input)) {
               code = fs.readFileSync(input).toString();
           }else {
               return null;
           }
       }

       return new Parser(code, options).source;
    },
    build:build
}
