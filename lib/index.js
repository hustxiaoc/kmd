var S = require("./loader/seed"),
    k2cmd = require("k2cmd"),
    parser = require("./parser"),
    path = require("path"),
    fs = require("fs"),
    _ = require("underscore");

var cache = {
    dependencies:{}
};

S.config("debug", false);

function getModuleInfo(filePath) {
    var packages = S.config("packages"),
        _package,
        moduleName;

    S.Utils.each(packages, function(package) {
        var base = package.base,
            name = package.name;

        if(package.ignorePackageNameInUri) {
            base = path.join(base,package.name);
        }
        var relative = path.relative(base,filePath);
        if(relative.indexOf("..") == -1){
            _package = package;
            moduleName = path.join(name,relative);
            return false;
        }
    });


    return {
        charset: _package && _package.charset,
        package:_package,
        moduleName:moduleName.replace(/\.js$/,"")
    }
}
function convert (code,options) {
    var dependencies,
        moduleInfo = {},
        _code;

    if(options.moduleInfo) {
        moduleInfo = options.moduleInfo
    }else if(options.filePath) {
        moduleInfo = getModuleInfo(options.filePath);
    }
    if(moduleInfo.moduleName) {
        if(cache.dependencies[moduleInfo.moduleName]) {
            dependencies = cache.dependencies[moduleInfo.moduleName];
        }else {
           dependencies = parser.getDependency(code);
           cache.dependencies[moduleInfo.moduleName]
        }
    }else{
        dependencies = parser.getDependency(code);
    }

    _code = parser.wrap(code,{
        requires:dependencies,
        moduleName: moduleInfo.moduleName,
        charset: moduleInfo.charset
    });

    return {
        minify:_code.minifyCode,
        source:_code.wrappedCode,
        moduleInfo:moduleInfo,
        dependencies:parser.getDependency(code)
    }
}

function combo(filePath) {

    var moduleInfo = getModuleInfo(filePath),
        mods = S.Utils.createModules([moduleInfo.moduleName]),
        modules = [];
        source = [],
        minify = [],
        files = [],
        loader =new S.Loader.ComboLoader(),

    S.Utils.each(mods, function (mod) {
        modules.push.apply(modules, mod.getNormalizedModules());
    });

    mods = loader.calculate(modules,[]);

    S.Utils.each(mods, function(mod) {
        var pkg = mod.packageInfo,
            base = pkg.base,
            filePath = null;
        if(pkg.name == "core") {
            return true;
        }
        if(mod.ignorePackageNameInUri) {
            base = path.join(base,pkg.name);
        }
        filePath = path.join(base,mod.name);
        if(!/\.js$/.test(filePath)) {
            filePath = filePath+'.js';
        }
        files.push(filePath);
        var code = fs.readFileSync(filePath).toString(),
            info = convert(code,{
                moduleInfo: {
                    charset: pkg.charset,
                    package:pkg,
                    moduleName:mod.name
                }
            });

        source.push(info.source);
        minify.push(info.minify);
    });

    return {
        source:source,
        minify:minify,
        files:files
    }
}

function config(key,value) {
    return S.config.apply(S,arguments);
}

module.exports = {
    config:config,
    combo:combo,
    convert: convert,
    minify:parser.minify
}