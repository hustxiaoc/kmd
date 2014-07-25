var S = require("./loader/seed"),
    parser = require("./parser"),
    path = require("path"),
    fs = require("fs"),
    _ = require("underscore");

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
        seajs:options.seajs,
        requires:dependencies,
        moduleName: options.fixModuleName ? moduleInfo.moduleName:null,
        charset: moduleInfo.charset
    });

    return {
        minify:_code.minifyCode,
        source:_code.wrappedCode,
        moduleInfo:moduleInfo,
        dependencies:parser.getDependency(code)
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
            name = mod.name,
            base = pkg.base,
            filePath = null;

        if(pkg.name == "core") {
            return true;
        }

        if(pkg.ignorePackageNameInUri) {
            name = name.replace(pkg.name,"");
        }
        filePath = path.join(base,name);

        if(!/\.js$/.test(filePath)) {
            filePath = filePath+'.js';
        }
        files.push(filePath);

        var code = fs.readFileSync(filePath).toString(),
            info = convert(code,{
                fixModuleName:true,
                seajs:options.seajs,
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
                     minify:parser.minify,
                     utils:S.Utils,
                     kissy2cmd: require("./parser/kissy2cmd")
                 }