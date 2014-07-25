
# kmd


## 简介
k2cmd的升级版  
Translate KISSY Module to CommonJs  Module（kmd）是一个基于NodeJS的KISSY模块转换工具，将以前的KISSY模块转换为1.4支持的cmd规范模块。  
如以下示例：

```js
KISSY.add("test", function(S, Node, IO){
    return {
        init: function() {
            var $ = Node.all;
            IO();
        }
    }
 },{
    requires: [
        "node",
        "io"
    ]
 }); 
 ```
 
 会转换成
 
 ```js
 KISSY.add("test",function(S ,require, exports, module) {
	var Node = require("node"),
		IO = require("io");

    module.exports =  {
        init: function() {
            var $ = Node.all;
            IO();
        }
    }
});

```  
和
```js
var Node = require("node"),
		IO = require("io");

    module.exports =  {
        init: function() {
            var $ = Node.all;
            IO();
        }
    }
```
这2种形式。
  
 

## 使用

### 安装
    npm install kmd -g


### 使用指南
kmd -h

  Usage: kmd [options]

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -b, --build [value]   build path
    -s, --source [value]  source path
    -m, --minify          minify or not
    -o, --stdout          disbale stdout or not
    -t, --type [value]    code style type, cmd or kissy
 -b 转换后存放路径  默认 ../build  
 -s 源码路径 默认 ./  
 -m 是否压缩  
 -o  是否禁用控制台输出提示信息
 -t 转换类型 cmd类型或kissy类型模块，默认kissy   

### API文档

```js
var kmd = require("kmd");
var code = kmd.parse(code, options); //kissy转cmd
var kissycode = kmd.cmd2kissy(cmdcode,modname,options); //cmd转kissy
var kissycode = kmd.cmd2kissy(cmdcode,options); //cmd转kissy
kmd.build({
	src: sourcePath,
	dest: buildPath,
	ignoreFiles:['-min.js'], //设置哪些文件不进行转换，支持正则
	filters:[/[\/]+\.\w+/],//设置哪些目录不进行转换，支持正则
	stdout: true,
	minify: false,	
	style: "kissy"
})
```
options数据结构

```js
{
    "minify" : boolean,//是否启动压缩
    "style"  : string,//代码风格 kissy风格(style=kissy),或者node风格(style=cmd)
}
```

### 转换后的commonJs模块如何打包发布成KISSY模块
请使用gulp-kmc插件进行打包，使用文档https://github.com/hustxiaoc/gulp-kmc

## License
遵守 "MIT"
 
