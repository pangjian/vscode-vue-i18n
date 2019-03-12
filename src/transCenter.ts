import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { google } from 'translation.js'

import Common from './utils/Common'
import i18nFiles from './utils/i18nFiles'

const EVENT_MAP = {
  ready: 'ready',
  allI18n: 'allI18n',
  trans: 'trans',
  writeTrans: 'writeTrans',
}

export class TransCenter {
  panel: vscode.WebviewPanel = null
  filePath: string = null
  shortFileName: string = null

  constructor(filePath: string) {
    this.filePath = filePath
    this.shortFileName = filePath
      .split(path.sep)
      .slice(-3)
      .join(path.sep)

    this.panel = vscode.window.createWebviewPanel(
      'transCenter',
      `翻译-${this.shortFileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    )

    const { webview } = this.panel

    
    let html = fs.readFileSync(
      path.resolve(Common.extension.extensionPath, 'static/transCenter.html'),
      'utf-8'
    )
    const resourcePath = path.join(Common.extension.extensionPath, 'static/transCenter.html');
    const dirPath = path.dirname(resourcePath);
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
      return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
    })
    
    webview.html = html;

    this.initMessage()
    this.initFileWatcher()
  }

  initMessage() {
    const {
      panel: { webview },
      shortFileName,
      filePath,
    } = this

    const onMessage = ({ type, data }) => {
      switch (type) {
        case EVENT_MAP.ready:
          webview.postMessage({
            type: EVENT_MAP.allI18n,
            data: {
              filePath: shortFileName,
              i18n: i18nFiles.getTrans(filePath),
            },
          })
          break

        case EVENT_MAP.trans:
          data.forEach(async i18nItem => {
            try {
              const transItemsResult = await i18nFiles.getTransByApi(
                i18nItem.transItems
              )
              const newI18nItem = {
                ...i18nItem,
                transItems: transItemsResult,
              }
              webview.postMessage({
                type: EVENT_MAP.trans,
                data: newI18nItem,
              })
              i18nFiles.writeTrans(filePath, newI18nItem)
            } catch (err) {
              console.error(err)
              webview.postMessage({
                type: EVENT_MAP.trans,
                data: i18nItem,
              })
            }
          })
          break

        case EVENT_MAP.writeTrans:
          i18nFiles.writeTrans(filePath, data)
          break

        default:
        //
      }
    }

    webview.onDidReceiveMessage(onMessage)
  }

  initFileWatcher() {
    const {
      panel,
      panel: { webview },
      shortFileName,
      filePath,
    } = this
    const watcher = vscode.workspace.createFileSystemWatcher(filePath)

    const updateI18n = () => {
      webview.postMessage({
        type: EVENT_MAP.allI18n,
        data: {
          filePath: shortFileName,
          i18n: i18nFiles.getTrans(filePath),
        },
      })
    }

    watcher.onDidChange(updateI18n)
    panel.onDidDispose(() => watcher.dispose())
  }
}

export default (ctx: vscode.ExtensionContext) => {
  const cmd = vscode.commands.registerCommand(
    'extension.vue-i18n.transCenter',
    (uri: vscode.Uri) => {
      new TransCenter(uri.fsPath)
    }
  )

  ctx.subscriptions.push(cmd)
}
