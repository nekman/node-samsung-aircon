
/**
 *
 * @param {number} ms
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 *
 * @param {number} ms
 */
export const timeout = ms => sleep(ms).then(() => Promise.reject(new Error('Timeout!')));

/**
*
* @param {string} head
* @param {{[x: string]: string}} vars
*/
export function getSSDPHeader(head, vars) {
 let ret = `${head} * HTTP/1.1\r\n`;

 Object.entries(vars).forEach(([key, value]) => {
   ret += `${key}: ${value}\r\n`;
 });

 return `${ret}\r\n`;
}
