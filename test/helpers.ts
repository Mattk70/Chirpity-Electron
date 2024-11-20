
import { Page } from 'playwright';

let page: Page;

async function openExampleFile(page: Page){
    await page.locator('#navBarFile').click()
    await page.locator('#open-file').click()
    await page.locator('wave').first().waitFor({state: 'visible'})
  }
  
  async function changeSettings(page: Page, type: string, elementID: string, value: any, timeout: number){
    elementID = '#' + elementID;
    await  page.locator('#navbarSettings').click();
    // for Birdnet's 34%$
    await page.locator('#confidence').fill('30');
    if (type === 'select'){
      await page.selectOption(elementID, value);
    } else if (type === 'switch'){
      await page.locator(elementID).setChecked(value);
    }  else {
      await page.locator(elementID).fill(value);
    }
    await page.locator('#close-settings').click();
    // Wait ?
    if (timeout) await page.waitForTimeout(timeout);
  }
  
  async function runExampleAnalysis(page: Page, model: string){
    await openExampleFile(page)
    await changeSettings(page,'select', 'model-to-use', model, 3000)
  
    await  page.locator('#navbarAnalysis').click()
    await page.locator('#analyse').click()
    await  page.locator('#resultTableContainer').waitFor({state: 'visible'})
  }

  export {changeSettings, openExampleFile, runExampleAnalysis}