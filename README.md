# vue-component

## 功能
1. template中输入组件名称自动提示找到的组件（详见设置说明），选中后自动输入组件名（包含必填属性）、import语句、components属性（如果有需要）。
2. 鼠标移到组件标签名称时按`Ctrl`，点击标签名称可跳转到组件文件。
3. 鼠标悬浮到组件标签，提示组件属性和事件。
4. 标签内输入`p-`提示属性，输入`e-`提示事件，选中后自动输入。

## 设置
+ `vueComponent.aliases` 配置文件路径别名，默认值`{ "@/": "src/" }`，另外还会读取项目根目录下`jsconfig.json`里的别名，并且优先级更高。
+ `vueComponent.exclude` 排除查找的vue文件路径，默认值`**/node_modules`，语法为GlobPattern，`null`为不排除任何路径。默认情况下插件不会搜索`node_modules`下的组件，可以调整这个配置以扩大、缩小搜索范围。自动输入`node_modules`下的组件可能会出现一些意料之外的效果。
 
## 说明
+ 功能1依赖于找到的vue文件。
+ 功能2依赖于当前组件的components属性和import语句，缺一不可，并且script不可有语法错误。另外如果组件名称是小写的单个词语，会被认为是html原生标签而跳过。
+ 功能3、4依赖于当前组件和目标组件的components属性、import语句，不可有语法错误。
+ 自动输入的代码建议配合格式化工具使用。


### Translate by machine
## Features
1. The component name entered in Template automatically prompts for the component found (see Settings), and automatically enters the component name (including required properties), import statement, and Components properties (if necessary) when selected.
2. Moves  the mouse to the component label name and press `Ctrl`, then click the label name to jump to the component file.
3. Hover the mouse over the component label, prompting for component properties and events.
4. In the component label, input `p-` prompt property, input `e-` prompt event, and input automatically after selected.

## Settings
+ `vueComponent.aliases` configuration file path alias, default value is `{ "@/": "src/" }`, in addition to reading the alias in the root directory of the project `jsconfig.json`, and higher priority.
+ `vuecomponent. exclude` vUE file path found, default is `**/node_modules`, grammar is GlobPattern, `null` means no path is excluded. Plug-ins don't search for components under `node_modules` by default, and you can adjust this configuration to expand and narrow the search. The components under `node_modules` may have some unexpected effects.
 
## Instructions
+ Function 1 depends on the vue files found.
+ Function 2 depends on the components properties and import statements of the current component.In addition, if the component name is a single word in lowercase, it will be skipped as a native HTML tag.
+ Functions 3 and 4 depend on the components properties and import statements of the current and target components and do not have syntax errors.
+ Automatic input code is recommended for use with formatting tools.
