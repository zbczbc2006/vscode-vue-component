// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const { parseFile, parseDocument } = require('./parse')
const {
  isInTag,
  getComNameByPosition,
  getRelativePath,
  toPascalCase,
  toKebabCase
} = require('./utils')
const {
  window,
  workspace,
  languages,
  commands,
  CompletionItemKind,
  CompletionItem,
  SnippetString,
  Uri,
  MarkdownString,
  Hover,
  Location,
  Position,
} = vscode

async function activate (context) {
  let allVueFilesSet
  let snipsnapList
  /**
  * 获取snipsnapList，为组件自动提示服务
  */
  function getSnipsnapList (filesSet) {
    return [...filesSet].map(file => {
      const name = path.basename(file, '.vue')
      const snipsnap = new CompletionItem(name, CompletionItemKind.Constructor)
      snipsnap.insertText = '' // 依靠后续命令，在确定组件后再解析文件、插入代码
      snipsnap.file = file // 添加一个自定义属性来记录
      snipsnap.command = { title: 'Import vue', command: 'vueComponent.importVue', arguments: [file, name] }
      return snipsnap
    })
  }
  // 获取所有vue文件并监听vue文件增删
  const exclude = workspace.getConfiguration().get('vueComponent.exclude')
  allVueFilesSet = new Set((await workspace.findFiles('**/*.vue', exclude)).map(f => f.fsPath))
  snipsnapList = getSnipsnapList(allVueFilesSet)
  const watcher = workspace.createFileSystemWatcher('**/*.vue')
  watcher.onDidCreate(e => {
    allVueFilesSet.add(e.fsPath)
    snipsnapList = getSnipsnapList(allVueFilesSet)
  })
  watcher.onDidDelete(e => {
    allVueFilesSet.delete(e.fsPath)
    snipsnapList = getSnipsnapList(allVueFilesSet)
  })

  /**
  * 组件自动提示
  */
  const componentsProvider = languages.registerCompletionItemProvider('vue', {
    async provideCompletionItems (document, position) {
      if (!isInTag(document, position, 'template') || getComNameByPosition(document, position)) return
      console.log(snipsnapList)
      return snipsnapList.filter(snipsnap => {
        if (snipsnap.file === document.fileName) return false
        if (!snipsnap.detail) snipsnap.detail = getRelativePath(document.fileName, snipsnap.file)
        return true
      })
    },
  })

  /**
  * 跳转到组件文件
  */
  const linkProvider = languages.registerDefinitionProvider('vue', {
    provideDefinition (document, position) {
      let comName = toPascalCase(document.getText(document.getWordRangeAtPosition(position, /[\w\-]+/)))
      let file = parseDocument(document).components[comName]
      if (file) {
        if (!fs.existsSync(file)) {
          file = path.join(vscode.workspace.rootPath, 'node_modules', file)
          if (!fs.existsSync(file)) return
        }
        return new Location(Uri.file(file), new Position(0, 0))
      }
    }
  })

  /**
  * 悬停提示
  */
  const hoverProvider = languages.registerHoverProvider('vue', {
    async provideHover (document, position) {
      if (!isInTag(document, position, 'template')) return
      const comName = getComNameByPosition(document, position)
      if (!comName) return
      const file = parseDocument(document).components[comName]
      const { props, events } = parseFile(file)
      const propsMdList = Object.keys(props).map(propName => {
        const prop = props[propName]
        let requiredText = ''
        let typeText = ''
        if (typeof prop === 'function') {
          typeText = `: ${prop.name}`
        } else if (Array.isArray(prop)) {
          typeText = `: ${prop.map(p => p.name).join()}`
        } else {
          const { required, type } = prop
          if (required) requiredText = '(required) '
          if (type) typeText = `: ${type.name}`
        }
        return new MarkdownString(`prop ${requiredText}${propName}${typeText}`)
      })
      const eventMdList = events.map(eventName => new MarkdownString(`event ${eventName}`))
      return new Hover(propsMdList.concat(eventMdList))
    }
  })

  /**
  * 属性事件自动提示
  */
  const propEventProvider = languages.registerCompletionItemProvider('vue', {
    provideCompletionItems (document, position) {
      if (!isInTag(document, position, 'template')) return
      const comName = getComNameByPosition(document, position)
      if (!comName) return
      const file = parseDocument(document).components[comName]
      const { props, events } = parseFile(file)
      const propsSnipsnap = Object.keys(props).map(prop => {
        const snipsnap = new CompletionItem(`p-${prop}`, CompletionItemKind.Property)
        snipsnap.insertText = new SnippetString(`:${toKebabCase(prop)}="$0"`)
        return snipsnap
      })
      const eventSnipsnap = events.map(event => {
        const snipsnap = new CompletionItem(`e-${event}`, CompletionItemKind.Event)
        snipsnap.insertText = new SnippetString(`@${toKebabCase(event)}="$0"`)
        return snipsnap
      })
      return propsSnipsnap.concat(eventSnipsnap)
    },
  })

  /**
  * 注册导入命令，出于性能考虑在确定补全的组件时才解析vue文件，仅内部使用
  */
  const importVue = commands.registerCommand('vueComponent.importVue', async (file, fileName) => {
    const editor = window.activeTextEditor
    const document = editor.document
    const fileNamePascal = toPascalCase(fileName)
    // 先在光标处插入组件代码
    const { props } = parseFile(file)
    let tabStop = 1
    const requiredPropsSnippetStr = Object.keys(props).filter(prop => props[prop].required)
      .reduce((accumulator, prop) => accumulator += ` :${toKebabCase(prop)}="$${tabStop++}"`, '')
    const snippetString = `<${fileNamePascal}${requiredPropsSnippetStr}>$0</${fileNamePascal}>`;
    await editor.insertSnippet(new SnippetString(snippetString))
    const components = parseDocument(document).components
    if (!components[fileNamePascal]) { // 没有注册组件，需要添加对应import、components
      const text = document.getText()
      // import代码      
      const scriptMatch = text.match(/\s+<script.*\s*/)
      let importPath = getRelativePath(document.fileName, file)
      if (importPath.includes('node_modules/')) {
        importPath = importPath.split('node_modules/')[1]
      }
      const importPosition = document.positionAt(scriptMatch.index + scriptMatch[0].length)
      const importStr = `import ${fileNamePascal} from '${importPath}'\n`
      // components代码
      let comPosition, comStr
      if (Object.keys(components).length > 0) { // 已有components属性
        const comMatch = text.match(/\s+components:\s{/)
        comPosition = document.positionAt(comMatch.index + comMatch[0].length)
        comStr = `\n    ${fileNamePascal},`
      } else {
        const comMatch = text.match(/\s+export default\s{/)
        comPosition = document.positionAt(comMatch.index + comMatch[0].length)
        comStr = `\n  components: { ${fileNamePascal} },`
      }

      editor.edit(edit => {
        edit.insert(importPosition, importStr);
        edit.insert(comPosition, comStr);
      })

    }
  });
  context.subscriptions.push(hoverProvider, componentsProvider, propEventProvider, linkProvider, importVue)
}
exports.activate = activate


module.exports = {
  activate
}
