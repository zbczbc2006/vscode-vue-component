const path = require('path')
const vscode = require('vscode')
/**
* 空元素，不需要自闭合
*/
// const VOID_ELEMENTS = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']
/**
* 是否在指定标签之内
* @author zhubincong
* @since 2020-06-30 19:46:37
*/
function isInTag (document, position, tagName) {
  const text = document.getText()
  const start = text.indexOf(`<${tagName}>`);
  const end = text.lastIndexOf(`</${tagName}>`);
  if (start === -1 || end === -1) {
    return false;
  }
  const startLine = document.positionAt(start).line;
  const endLine = document.positionAt(end).line;
  return position.line > startLine && position.line < endLine;
}

/**
* 获取文档在某个位置的自定义标签
* @author zhubincong
* @since 2020-07-01 11:05:35
*/
function getComNameByPosition (document, position) {
  let lineText = ''
  let comName = ''
  let match = ''
  const tagReg = /<\/?([\w-]+)/
  const customTagReg = /[A-Z-]/
  for (let line = position.line; line >= 0 && !match; line--) {
    lineText = document.lineAt(line).text
    if (lineText.includes('>') && line !== position.line) return ''
    match = lineText.match(tagReg)
  }
  if (match) comName = match[1]
  return customTagReg.test(comName) ? toPascalCase(comName) : ''
}

/**
* 获取相对路径，针对vue
* @author zhubincong
* @since 2020-07-06 19:01:08
*/
function getRelativePath (from, to) {
  let resultPath = path.relative(from, to).replace(/\\/g, '/')
  const start = resultPath.startsWith('../../') ? 3 : 1 // 去一层目录
  const end = resultPath.length - 4 // 去掉扩展名.vue
  return resultPath.slice(start, end)
}

/**
* 短横线命名法转为帕斯卡命名法
* @author zhubincong
* @since 2020-07-06 19:38:35
*/
function toPascalCase (str) {
  return str.replace(/(^|-)([a-z])/g, (keb, s1, s2) => s2.toUpperCase())
}
/**
* 帕斯卡命名法转为短横线命名法
* @author zhubincong
* @since 2020-07-06 19:38:35
*/
function toKebabCase (str) {
  const result = str.replace(/([A-Z])/g, (keb, s1) => '-' + s1.toLowerCase())
  return result.startsWith('-') ? result.slice(1) : result
}

/**
* 获取jsconfig.json中的别名
* @author zhubincong
* @since 2020-07-06 20:45:30
*/
function getProjectAliases () {
  let paths = {}
  try {
    const { compilerOptions } = require(vscode.workspace.rootPath + '/jsconfig.json');
    paths = compilerOptions.paths;
  } catch (e) { }
  return Object.keys(paths).reduce((aliases, key) => {
    aliases[key.replace('*', '')] = paths[key][0].replace('*', '')
    return aliases
  }, {})
}

module.exports = {
  isInTag,
  getComNameByPosition,
  getRelativePath,
  toPascalCase,
  toKebabCase,
  getProjectAliases
}