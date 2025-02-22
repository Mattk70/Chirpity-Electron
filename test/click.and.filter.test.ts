import { _electron as electron, JSHandle } from 'playwright';
import { test, expect } from '@playwright/test';
import { 
  findLatestBuild, 
  // ipcMainCallFirstListener, 
  // ipcRendererCallFirstListener, 
  parseElectronApp,
  ipcMainInvokeHandler,
  // ipcRendererInvoke,
  // ipcRendererSend,
  // ipcMainEmit,
  stubMultipleDialogs
} from 'electron-playwright-helpers';
import { ElectronApplication, Page } from 'playwright';
import {changeSettings, openExampleFile, runExampleAnalysis} from './helpers'
//import {Jimp} from 'jimp';

let electronApp: ElectronApplication;
let UIpage: Page;
let _worker: Page;
let bwHandle: JSHandle<Electron.BrowserWindow>;
let example_file: any;
// find the latest build in the out directory
const latestBuild = findLatestBuild('./dist')
// parse the directory and find paths and other info
const appInfo = parseElectronApp(latestBuild)
// set the CI environment variable to true
process.env.CI = 'e2e';


test.beforeAll(async () => {

  electronApp = await electron.launch({
    args: [appInfo.main],
    executablePath: appInfo.executable,
    env: {
      ...process.env,
      TEST_ENV: 'true'
    }

  })

  // Get the path for the example file we want to load
  example_file = process.cwd() + "/build/ci-test.m4a"
  console.log('example file:', example_file)
  await stubMultipleDialogs(electronApp, [
    {
      method: 'showOpenDialog',
      value: {
        filePaths: [example_file],
        canceled: false,
      },
    },
    {
       method: 'showSaveDialog',
       value: {
         filePath: '/path/to/file',
         canceled: false,
       },
     },
   ])
   _worker = await electronApp.firstWindow()

   await new Promise<void>((resolve) => {
    electronApp.on('window', async (window) => {
      const filename = window.url()?.split('/').pop()
      console.log(`Window opened: ${filename}`)
      UIpage = window;
      UIpage.on('pageerror', (error) => {
        console.error(error)
      })
      // capture console messages
      UIpage.on('console', (msg) => {
        console.log(msg.text())
      })

      _worker.on('pageerror', (error) => {
        console.error(error)
      })
      // capture console messages
      _worker.on('console', (msg) => {
        console.log(msg.text())
      })
      // Wait for the UIpage to load
      await UIpage.waitForLoadState('load')
      _worker.on('worker', () => {
        //console.log('worker.js worker data')
        resolve();
      });
      
    })
  })

})

test.afterAll(async () => {
  //await UIpage.pause()
  await electronApp.close()
})

test.describe.configure({ mode: 'parallel', retries: 1, timeout: 60_000 });

/*
REMEMBER TO REBUILD THE APP IF THE *APPLICATION CODE* NEEDS TO BE CHANGED
                                    ----------------
*/


test("Can click rapidly through results", async () =>{
  await runExampleAnalysis(UIpage, 'chirpity');
  for (let i=1;i<40;i++){
    const result = await UIpage.locator(`#result${i}`)
    await result.click();
    // Need to find a way to inspect & count the max regions (shouldn't be more than 7)
  }

})

test("Can click rapidly on species filters", async () =>{
  for (let i=2;i<40;i++){
    const result = await UIpage.locator(`#summary tr:nth-of-type(${i})`)
    await result.click();
    // Need to find a way to inspect & count the max regions (shouldn't be more than 7)
  }
})
