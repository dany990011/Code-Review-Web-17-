const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('../requirements.pdf'));

doc.fontSize(20).text('PC Build Shop - Project Requirements', {align: 'center'}).moveDown();

doc.fontSize(16).text('1. Homepage & Navigation');
doc.fontSize(12).text('- Must have a hero section with a call-to-action.');
doc.text('- Must have a navigation bar with links.').moveDown();

doc.fontSize(16).text('2. Product Catalog');
doc.fontSize(12).text('- Must display a list of PC parts (CPUs, GPUs, RAM, Motherboards).');
doc.text('- Users must be able to filter products by category.').moveDown();

doc.fontSize(16).text('3. Custom PC Builder');
doc.fontSize(12).text('- There must be a dedicated page where users can select compatible parts.');
doc.text('- The UI must visually indicate if selected parts are incompatible.').moveDown();

doc.fontSize(16).text('4. Shopping Cart');
doc.fontSize(12).text('- Users must be able to add items to a shopping cart.');
doc.text('- The cart must display the total price.').moveDown();

doc.end();
console.log('PDF generated successfully.');
