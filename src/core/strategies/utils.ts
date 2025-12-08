/**
 * Utility functions for healing strategies
 */

import { Page } from '@playwright/test';

/**
 * Check if a selector exists on the page
 */
export async function checkSelectorExists(page: Page, selector: string): Promise<boolean> {
  try {
    const count = await page.locator(selector).count();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateUrl(url: string, allowedHosts: string[] = ['localhost', '127.0.0.1']): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check if hostname is in allowed list
    const isAllowed = allowedHosts.some(host => 
      hostname === host || hostname.endsWith(`.${host}`)
    );
    
    if (!isAllowed) {
      return false;
    }
    
    // Disallow non-standard ports for security (only allow common ports)
    const port = urlObj.port;
    if (port && !['80', '443', '8080', '11434'].includes(port)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
