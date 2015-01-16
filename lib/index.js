var S = require("./loader/seed"),
    compiler = require("./compiler"),
    path = require("path"),
    fs = require("fs");

require('./log')();

var cache = {
    dependencies:{}
};

S.config("debug", false);

var loadModsFn = S.config("loadModsFn");

S.config("loadModsFn", function(rs, config) {
    loadModsFn.apply(null,arguments);
});


function getModuleInfo(filePath) {
    var packages = S.config("packages"),
        _package,
        moduleName;

    S.Utils.each(packages, function(package) {
        var base = package.base,
            name = package.name;

        if(filePath.indexOf(name) == 0) {
            moduleName = filePath;
            return false;
        }

        var relative = path.relative(base,filePath);

        if(relative.indexOf("..") == -1){
            _package = package;
            moduleName = relative;
            if(moduleName.indexOf(package.name)!==0) {
                moduleName = path.join(name, relative);
            }
            moduleName = moduleName.replace(/\\/g,"/");
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
        options = options || {},
        moduleInfo = {},
        _code;

    options.fixModuleName = options.fixModuleName ===  false?false:true;

    code = ' '+code;
    if(options.requireCss === false) {
        var requireRegExp = /[^.'"]\s*require\s*\((['"])([^)]+)\1\)\s*;?/g;
        code = code.replace(requireRegExp, function(match, _, dep){
            if(/\.css$/.test(dep)) {
                return match.replace(/require\s*\((['"])([^)]+)\1\)\s*;?/,'');
            }
            return match;
        });
    }

    if(options.moduleInfo) {
        moduleInfo = options.moduleInfo
    }else if(options.filePath) {
        moduleInfo = getModuleInfo(options.filePath);
    }
    if(moduleInfo.moduleName) {
        if(cache.dependencies[moduleInfo.moduleName]) {
            dependencies = cache.dependencies[moduleInfo.moduleName];
        }else {
           dependencies = S.Utils.getRequiresFromFn(code);
           cache.dependencies[moduleInfo.moduleName]
        }
    }else{
        dependencies = S.Utils.getRequiresFromFn(code);
    }

    _code = compiler.wrap(code,{
        define:options.define,
        modulex: options.modulex,
        kissy: options.kissy,
        requires:dependencies,
        moduleName: options.fixModuleName ? moduleInfo.moduleName:null,
        charset: moduleInfo.charset
    });

    return {
        source:_code,
        moduleInfo:moduleInfo,
        dependencies:S.Utils.getRequiresFromFn(code)
    }
}

function clearLoadedModule() {
    S.Utils.each(S.Env.mods, function(mod){
        if(mod.status) {
            if(mod.packageInfo && mod.packageInfo.name!=="core" && mod.packageInfo.base!=="http://core/"){
                mod.status = 0;
            }
        }
    });
}

function combo(filePath,options) {

    var options = options || {};
    var moduleInfo = getModuleInfo(filePath),
        mods = S.Utils.createModules([moduleInfo.moduleName]),
        modules = [];
        source = [],
        minify = [],
        files = [],
        loader =new S.Loader.ComboLoader();

    clearLoadedModule();

    S.Utils.each(mods, function (mod) {
        modules.push.apply(modules, mod.getNormalizedModules());
    });

    mods = loader.calculate(modules,[]);

    S.Utils.each(mods, function(mod) {
        var pkg = mod.packageInfo,
            name = mod.name;
        if(pkg.name == "core") {
            return true;
        }
        files.push(name);
    });

    return files;
}

function config(key,value) {
    return S.config.apply(S,arguments);
}


module.exports = {
                     config:config,
                     combo:combo,
                     convert: convert,
                     getModuleInfo:getModuleInfo,
                     utils:S.Utils
                 }