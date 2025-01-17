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
let page: Page;
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
  example_file = await ipcMainInvokeHandler(electronApp, 'getAudio')
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
      page = window;
      page.on('pageerror', (error) => {
        console.error(error)
      })
      // capture console messages
      page.on('console', (msg) => {
        console.log(msg.text())
      })
      // Wait for the page to load
      await page.waitForLoadState('load')
      resolve();
    })
  })

})

test.afterAll(async () => {
  //await page.pause()
  await electronApp.close()
})

test.describe.configure({ mode: 'parallel', retries: 1, timeout: 60_000 });

/*
REMEMBER TO REBUILD THE APP IF THE *APPLICATION CODE* NEEDS TO BE CHANGED
                                    ----------------
*/

// test('Tour modal appears', async () => {
//   await page.locator('#tourModal').waitFor({state: 'visible'});
//   await page.waitForTimeout(500);
//   const closeButton = await page.locator('#close-tour')
//   expect(closeButton).toBeVisible()
//   await page.locator('#close-tour').click();
// })



// test("check if worker window is visible", async () => {
//   bwHandle = await electronApp.browserWindow(page);
//   const visible = await bwHandle.evaluate((win) => win.isVisible());
//   expect(visible).toBeFalsy();
// });

test('Page title is correct', async () => {
  const title = await page.title()
  console.log('title: ', title)
  console.log('url: ', page.url())
  
  expect(title).toBe('Chirpity Bird Call Detection')
})


test(`Nocmig analyse works and second result is 61%`, async () => {
  // Set a custom timeout for this specific test (in milliseconds)

  await runExampleAnalysis(page,'chirpity');
  const callID = page.locator('#speciesFilter').getByText('Redwing (call)');
  expect(callID).not.toBe(undefined)
  const secondResult = await (await page.waitForSelector('#result2 span.confidence-row > span')).textContent()
  // console.log(secondResult, 'second result');
  expect(secondResult).toBe('61%');
})

test(`BirdNET analyse works and second result is 34%`, async () => {
  // Set a custom timeout for this specific test (in milliseconds)
  test.setTimeout(60000); // 60 seconds
  await runExampleAnalysis(page, 'birdnet');
  const callID = page.locator('#speciesFilter').getByText('Redwing (call)');
  expect(callID).not.toBe(undefined)
  const secondResult = await (await page.waitForSelector('#result2 span.confidence-row > span')).textContent()
  // console.log(secondResult, 'second result');
  expect(secondResult).toBe('34%');
})


// test(`Audacity labels work`, async () => {
  
  // // Everything shows 8 rows @ 45%
  // await runExampleAnalysis('chirpity')
  // await changeSettings('select', 'list-to-use', 'everything', 500);
  // const labels = await page.evaluate(() => window.AUDACITY_LABELS[window.STATE.currentFile]);
  // console.log(labels)
  // expect(labels.length).toBe(8);
  // // nocturnal shows 2 rows @ 45%
  // await changeSettings('select', 'list-to-use', 'nocturnal', 500);
  // const labels2 = await page.evaluate(() => window.AUDACITY_LABELS[window.STATE.currentFile]);
  // expect(labels2.length).toBe(2);
  // expect(labels2[0].cname).toBe("Redwing (call)")
  // // reset the list to default
  // await page.evaluate(() => {
  //   config.list = 'nocturnal'
  // })
// })

test("Amend file start dialog contains date", async () =>{
  await runExampleAnalysis(page, 'chirpity');
  await page.locator('#dropdownMenuButton').click({button: 'right'});
  await page.locator('#setFileStart').click();
  const fileStart = page.locator('#fileStart');
  const entry = await fileStart.inputValue();
  const currentYear = new Date().getFullYear().toString();
  expect(entry.toString()).toContain(currentYear);
  // await page.locator('#spectrogramWrapper button.btn-secondary').click();
})

test("Select inverted greyscale colourmap", async () =>{
  await runExampleAnalysis(page, 'chirpity');
  await changeSettings(page, 'select', 'colourmap', 'igreys', 50)
  // await page.locator('#spectrogramWrapper button.btn-secondary').click();
})


/* 
The current issue with click fest is that while element are hidden, they can't be clicked.

*/

test.describe.fixme('blocked by elements not being open', () =>{

    test('copes with click fest, including hidden elements', async () => {
      // Ensure dropdown menus are opened before interacting with their items
      const dropdownToggles = page.locator('[data-bs-toggle="dropdown"], [aria-haspopup="true"]');
      for (let i = 0; i < await dropdownToggles.count(); i++) {
        try {
          const toggle = dropdownToggles.nth(i);
          await toggle.click(); // Open the dropdown
          console.log('Opened dropdown:', await toggle.getAttribute('aria-label') || 'No label');
        } catch (error) {
          console.error('Error opening dropdown:', error);
        }
      }
    
      // Ensure off-canvas panels are opened
      const offCanvasToggles = page.locator('[data-bs-toggle="offcanvas"]');
      for (let i = 0; i < await offCanvasToggles.count(); i++) {
        try {
          const toggle = offCanvasToggles.nth(i);
          await toggle.click(); // Open the off-canvas panel
          console.log('Opened off-canvas panel:', await toggle.getAttribute('aria-label') || 'No label');
        } catch (error) {
          console.error('Error opening off-canvas panel:', error);
        }
      }
    
      // Get all clickable elements
      const clickableElements = page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]');
      for (let i = 0; i < await clickableElements.count(); i++) {
        try {
          const element = clickableElements.nth(i);
          await element.click({ force: true }); // Force click in case it's hidden
          console.log('Clicked element:', await element.innerText());
        } catch (error) {
          console.error('Error clicking element:', error);
        }
      }
    
      // Interact with checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      for (let i = 0; i < await checkboxes.count(); i++) {
        try {
          const checkbox = checkboxes.nth(i);
          await checkbox.check({ force: true }); // Force interaction
          console.log('Checked checkbox:', await checkbox.getAttribute('name'));
        } catch (error) {
          console.error('Error checking checkbox:', error);
        }
      }
    
      // Interact with radio buttons
      const radioButtons = page.locator('input[type="radio"]');
      for (let i = 0; i < await radioButtons.count(); i++) {
        try {
          const radioButton = radioButtons.nth(i);
          await radioButton.check({ force: true }); // Force interaction
          console.log('Selected radio button:', await radioButton.getAttribute('name'));
        } catch (error) {
          console.error('Error selecting radio button:', error);
        }
      }
    
      // Interact with dropdowns
      const dropdowns = page.locator('select');
      for (let i = 0; i < await dropdowns.count(); i++) {
        try {
          const dropdown = dropdowns.nth(i);
          const options = dropdown.locator('option');
          if (await options.count() > 1) {
            await dropdown.selectOption({ index: 1 });
            console.log('Selected option from dropdown:', await dropdown.getAttribute('name'));
          }
        } catch (error) {
          console.error('Error selecting dropdown option:', error);
        }
      }
    
      // Interact with text inputs
      const textInputs = page.locator('input[type="text"], textarea');
      for (let i = 0; i < await textInputs.count(); i++) {
        try {
          const textInput = textInputs.nth(i);
          await textInput.fill('Test value');
          console.log('Filled text input:', await textInput.getAttribute('name'));
        } catch (error) {
          console.error('Error filling text input:', error);
        }
      }
    });
    
    // test('Check spectrogram before and after applying filter are different', async () => {
      
      // page = await electronApp.waitForEvent('window')
      // // take a screenshot of the current page
      // const screenshot1: Buffer = await page.screenshot()
      // await page.getByRole('button', { name: 'Settings' }).click();
      // await page.getByLabel('Low Shelf filter:').fill('1200');
      // await page.getByLabel('Attenuation:').fill('18');
      // await page.getByText('blur_on').click();
      // await page.getByRole('button', { name: 'Settings' }).isHidden();
      // await page.waitForFunction(() => getFileLoaded());
      // // take a screenshot of the page after filter applied
      // const screenshot2: Buffer = await page.screenshot()
      // // compare the two images
      // const different = jimp.diff(await jimp.read(screenshot1), await jimp.read(screenshot2), 0.001)
      // expect(different.percent).toBeGreaterThan(0)
      // // Reset blur
      // await page.getByText('blur_on').click();
    // })
    
    
    // test('send IPC message from renderer', async () => {
    //   // evaluate this script in render process
    //   // requires webPreferences.nodeIntegration true and contextIsolation false
    //   await page.evaluate(() => {
    //     // eslint-disable-next-line @typescript-eslint/no-var-requires
    //     require('electron').ipcRenderer.send('new-window')
    //   })
    //   const newPage = await electronApp.waitForEvent('window')
    //   expect(newPage).toBeTruthy()
    //   expect(await newPage.title()).toBe('Window 4')
    //   page = newPage
    // })
    
    // test('receive IPC invoke/handle via renderer', async () => {
    //   // evaluate this script in RENDERER process and collect the result
    //   const result = await ipcRendererInvoke(page, 'how-many-windows')
    //   expect(result).toBe(4)
    // })
    
    // test('receive IPC handle data via main', async () => {
    //   // evaluate this script in MAIN process and collect the result
    //   const result = await ipcMainInvokeHandler(electronApp, 'openFiles')
    //   expect(result).toBe(4)
    // })
    
    // test('receive synchronous data via ipcRendererCallFirstListener()', async () => {
    //   const data = await ipcRendererCallFirstListener(page, 'get-synchronous-data')
    //   expect(data).toBe('Synchronous Data')
    // })
    
    // test('receive asynchronous data via ipcRendererCallFirstListener()', async () => {
    //   const data = await ipcRendererCallFirstListener(page, 'get-asynchronous-data')
    //   expect(data).toBe('Asynchronous Data')
    // })
    
    // test('receive synchronous data via ipcMainCallFirstListener()', async () => {
    //   const data = await ipcMainCallFirstListener(electronApp, 'main-synchronous-data')
    //   expect(data).toBe('Main Synchronous Data')
    // })
    
    // test('receive asynchronous data via ipcMainCallFirstListener()', async () => {
    //   const data = await ipcMainCallFirstListener(electronApp, 'main-asynchronous-data')
    //   expect(data).toBe('Main Asynchronous Data')
    // })
    
    // test('select a menu item via the main process', async () => {
    //   await clickMenuItemById(electronApp, 'new-window')
    //   const newPage = await electronApp.waitForEvent('window')
    //   expect(newPage).toBeTruthy()
    //   expect(await newPage.title()).toBe('Window 5')
    //   page = newPage
    // })
    
    

})