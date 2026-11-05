export type PortableContact = { name:string; phone?:string; email?:string; address?:string; role?:string; notes?:string };
export function parseContactImport(text:string,fileName?:string):PortableContact[];
export function contactsToVCard(contacts:PortableContact[]):string;
