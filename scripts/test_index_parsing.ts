/**
 * Test du parsing de l'index HTML
 */

const testHtml = `<table class="tableFile" summary="Document Format Files">
         <tbody><tr>
            <th scope="col" style="width: 5%;"><acronym title="Sequence Number">Seq</acronym></th>
            <th scope="col" style="width: 40%;">Description</th>
            <th scope="col" style="width: 20%;">Document</th>
            <th scope="col" style="width: 10%;">Type</th>
            <th scope="col">Size</th>
         </tr>
         <tr>
            <td scope="row">1</td>
            <td scope="row">FORM 4</td>
            <td scope="row"><a href="/Archives/edgar/data/1045810/000158867025000013/xslF345X05/wk-form4_1762387575.xml">wk-form4_1762387575.html</a></td>
            <td scope="row">4</td>
            <td scope="row">&nbsp;</td>
         </tr>
         <tr class="evenRow">
            <td scope="row">1</td>
            <td scope="row">FORM 4</td>
            <td scope="row"><a href="/Archives/edgar/data/1045810/000158867025000013/wk-form4_1762387575.xml">wk-form4_1762387575.xml</a></td>
            <td scope="row">4</td>
            <td scope="row">29301</td>
         </tr>
      </tbody></table>`;

const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
let rowMatch;
let rowCount = 0;

while ((rowMatch = rowRegex.exec(testHtml)) !== null) {
  const rowContent = rowMatch[1];
  
  // Extraire les colonnes (td)
  const tdMatches = rowContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
  if (!tdMatches || tdMatches.length < 4) {
    console.log(`Row ${rowCount}: Skipping (not enough columns)`);
    rowCount++;
    continue;
  }
  
  // Colonne 1: Seq (ignorée)
  // Colonne 2: Description
  const descriptionMatch = tdMatches[1]?.match(/>([^<]+)</);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';
  
  // Colonne 3: Document (lien)
  const documentMatch = tdMatches[2]?.match(/href=["']([^"']+)["']/);
  const documentHref = documentMatch ? documentMatch[1] : '';
  const documentText = tdMatches[2]?.match(/>([^<]+)</)?.[1]?.trim() || '';
  
  // Colonne 4: Type
  const typeMatch = tdMatches[3]?.match(/>([^<]+)</);
  const type = typeMatch ? typeMatch[1].trim() : '';
  
  console.log(`Row ${rowCount}:`);
  console.log(`  Description: "${description}"`);
  console.log(`  Type: "${type}"`);
  console.log(`  Href: "${documentHref}"`);
  console.log(`  Href ends with .xml: ${documentHref.endsWith('.xml')}`);
  console.log(`  Text: "${documentText}"`);
  
  // Vérifier les critères: Description="FORM 4", Type="4", Document (href) se terminant par .xml
  if (description === 'FORM 4' && type === '4' && documentHref && documentHref.endsWith('.xml')) {
    console.log(`  ✅ MATCH FOUND!`);
    const fullUrl = documentHref.startsWith('/Archives/edgar/data/')
      ? `https://www.sec.gov${documentHref}`
      : documentHref;
    console.log(`  Full URL: ${fullUrl}`);
  } else {
    console.log(`  ❌ No match`);
  }
  console.log('');
  
  rowCount++;
}
