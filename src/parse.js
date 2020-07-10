/**
* 用于解析vue、mixins文件
* @author zhubincong
* @since 2020-07-01 17:16:43
*/
const compiler = require('vue-template-compiler')
const acorn = require("acorn");
const jsx = require("acorn-jsx")
const acornJSX = acorn.Parser.extend(jsx())
const escodegen = require('escodegen')
const vscode = require('vscode')
const path = require('path')
const hash = require('hash-sum')
const fs = require('fs')
const { getProjectAliases } = require('./utils')
const Catch = require('lru-cache')
const vueCatch = new Catch(100)
const editCatch = new Catch(10)


/**
* 解析的文件类型
*/
const FILE_TYPE = {
  VUE: 'vue',
  MIXINS: 'mixins'
}

/**
* 指定代码块
*/
const IMPORT_DECLARATION = 'ImportDeclaration'
const EXPORT_DECLARATION = 'ExportDefaultDeclaration'

class Parser {
  constructor(content, file) {
    this.content = content
    this.file = file
    this.sfc = {}
    this.script = ''
    this.ast = []
    this.mixins = {}
    this.props = {}
    this.components = {}
    this.events = {}
  }

  getMixins () {
    let str = this.getOptionsStr('mixins')
    if (str) {
      let mixinsMatch = str.match(/\[([\w\W]*)\]/)
      if (mixinsMatch) {
        let mixins = {}
        mixinsMatch[1].split(',').forEach(n => {
          n = n.trim()
          mixins[n] = this.getImportFile(n, '.js')
        })
        this.mixins = mixins
      }
    }
    return this
  }

  getProps () {
    let props = {}
    // 先获取mixins的props
    Object.values(this.mixins).forEach(file => {
      Object.assign(props, parseFile(file, FILE_TYPE.MIXINS).props)
    })
    let str = this.getOptionsStr('props')
    if (str) {
      try {
        let currProp = eval(`(${str.slice(str.indexOf(':') + 1)})`)
        if (Array.isArray(currProp)) {
          currProp = currProp.reduce((pre, curr) => {
            pre[curr] = {}
            return pre
          }, {})
        }
        Object.assign(props, currProp)
      } catch (e) { }
    }
    this.props = props
    return this
  }

  getcomponents () {
    let components = {}
    // 先获取mixins的components
    Object.values(this.mixins).forEach(file => {
      Object.assign(components, parseFile(file, FILE_TYPE.MIXINS).components)
    })
    let str = this.getOptionsStr('components')
    if (str) {
      let componentsMatch = str.match(/{([\w\W]*)}/)
      if (componentsMatch) {
        componentsMatch[1].split(',').forEach(n => {
          n = n.trim()
          components[n] = this.getImportFile(n, '.vue')
        })
      }
    }
    this.components = components
    return this
  }

  getEvents () {
    let events = []
    // 先获取mixins的events
    Object.values(this.mixins).forEach(file => {
      events = events.concat(parseFile(file, FILE_TYPE.MIXINS).events)
    })
    const currEvents = this.content.match(/(?<=\$emit\(\s*["'])[\w-]+/g)
    if (currEvents) events.push(...currEvents)
    this.events = [...new Set(events)]
    return this
  }

  getOptionsStr (attr) {
    const exportAst = this.ast.body.find(n => n.type === EXPORT_DECLARATION)
    const attrAst = exportAst.declaration.properties.find(n => n.key.name === attr)
    return attrAst ? escodegen.generate(attrAst) : ''
  }

  getImportFile (importName, extension = '.vue') {
    const importAst = this.ast.body.find(n => n.type === IMPORT_DECLARATION && n.specifiers.find(m => m.local.name === importName))
    if (!importAst) return null
    let file = importAst.source.value
    if (!file.endsWith(extension)) file += extension
    // 获取别名以替换，vscode的设置返回是个Proxy，只能如此了
    const aliasesFromSetting = vscode.workspace.getConfiguration().get('vueComponent.aliases')
    const aliasesFromFile = getProjectAliases()
    const keyList = Object.keys(aliasesFromSetting).concat(Object.keys(aliasesFromFile))
    const key = keyList.find(n => file.startsWith(n))
    if (key) {
      file = file.replace(key, aliasesFromFile[key] || aliasesFromSetting[key])
      file = path.resolve(vscode.workspace.rootPath, file)
    } else if (file.startsWith('.')) {
      file = path.resolve(path.dirname(this.file), file)
    }
    return file
  }

  /**
  * 获取完必要数据后清除大数据，减少内存消耗
  */
  removeCatch () {
    this.content = null
    this.file = null
    this.script = null
    this.ast = null
    this.sfc = null
    return this
  }
}

/**
* 用于解析vue文件
*/
class VueParser extends Parser {
  constructor(content, file) {
    super(content, file)
    this.sfc = {}
    this.parse(content)
  }

  parse (content) {
    if (!content) return
    this.sfc = compiler.parseComponent(content)
    this.script = this.sfc.script.content
    this.ast = acornJSX.parse(this.script, { sourceType: 'module', allowNamespacedObjects: true })
    this.getMixins()
      .getProps()
      .getcomponents()
      .getEvents()
      .removeCatch()
  }
}

/**
* 用于解析Mixin文件
*/
class MixinParser extends Parser {
  constructor(content, file) {
    super(content, file)
    this.parse(content)
  }

  parse (content) {
    this.script = content
    this.ast = acornJSX.parse(this.script, { sourceType: 'module', allowNamespacedObjects: true })
    this.getMixins()
      .getProps()
      .getcomponents()
      .getEvents()
      .removeCatch()
  }
}

/**
* 仅解析components
*/
class componentsParser extends Parser {
  constructor(content, file) {
    super(content, file)
    this.parse(content)
  }

  parse (content) {
    this.sfc = compiler.parseComponent(content)
    this.script = this.sfc.script.content
    this.ast = acornJSX.parse(this.script, { sourceType: 'module', allowNamespacedObjects: true })
    this.getcomponents()
      .removeCatch()
  }

}

/**
* 解析vue、mixins
* @author zhubincong
* @since 2020-07-06 17:59:21
*/
function parseFile (file, type = FILE_TYPE.VUE) {
  if (!fs.existsSync(file)) {
    file = path.join(vscode.workspace.rootPath, 'node_modules', file)
    if (!fs.existsSync(file)) return {}
  }
  let state = fs.statSync(file)
  let cacheKey = hash(state.mtimeMs + file)
  let parseResult = vueCatch.get(cacheKey)
  if (!parseResult) {
    const content = fs.readFileSync(file, 'utf8');
    try {
      parseResult = type === FILE_TYPE.VUE ? new VueParser(content, file) : new MixinParser(content, file)
    } catch (error) {
      parseResult = {}
    }
    vueCatch.set(cacheKey, parseResult)
  }
  return parseResult
}

/**
* 解析正在编辑的vue文件
* @author zhubincong
* @since 2020-07-06 17:59:54
*/
function parseDocument (document) {
  const content = document.getText()
  let cacheKey = hash(content)
  let parseResult = editCatch.get(cacheKey)
  if (!parseResult) {
    try {
      parseResult = new componentsParser(content, document.fileName)
    } catch (error) {
      parseResult = {}
    }
    editCatch.set(cacheKey, parseResult)
  }
  return parseResult
}

module.exports = {
  parseFile,
  parseDocument
}