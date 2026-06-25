/**
 * Client-side PDF export (pdfmake) for the two reports:
 *   - generateAuditPDF      : the lecturer's audit report (AI findings vs. overrides)
 *   - generateWorkspacePDF  : the student's scorecard (checklist + scores)
 *
 * The import/vfs dance below normalizes pdfmake + its bundled fonts across the
 * different ways bundlers expose their default vs. namespace exports; without
 * wiring `vfs`, pdfmake throws "File 'Roboto' not found" at render time.
 */
import * as pdfMakeModule from 'pdfmake/build/pdfmake';
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts';

const pdfMake = pdfMakeModule.default || pdfMakeModule;
const pdfFonts = pdfFontsModule.default || pdfFontsModule;

pdfMake.vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;

export const generateAuditPDF = (projectData, groupName) => {
  const checkedCount = projectData?.checkedChecklistIds?.length || 0;
  
  const docDefinition = {
    content: [
      { text: `Audit Report: ${groupName}`, style: 'header' },
      { text: 'Detailed breakdown of AI findings vs. Student overrides', style: 'subheader' },
      
      { text: 'Checklist Progress', style: 'sectionHeader', margin: [0, 15, 0, 5] },
      { text: `Items checked off by student: ${checkedCount} / 12`, margin: [0, 0, 0, 15] },
      
      { text: 'Identified Issues & Overrides', style: 'sectionHeader', margin: [0, 15, 0, 5] },
    ],
    styles: {
      header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 12, italics: true, color: 'gray', margin: [0, 0, 0, 20] },
      sectionHeader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
      categoryHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
      scoreText: { fontSize: 10, bold: true, color: '#ef4444' }, // Red
      overrideText: { fontSize: 10, bold: true, color: '#3b82f6' }, // Blue
      reasoning: { fontSize: 11, margin: [0, 0, 0, 10], color: '#333333' },
      reasoningOverridden: { fontSize: 11, margin: [0, 0, 0, 10], color: '#9ca3af', decoration: 'lineThrough' },
      commentHeader: { fontSize: 10, bold: true, color: '#6b7280', margin: [0, 5, 0, 2] },
      commentText: { fontSize: 11, italics: true, margin: [10, 0, 0, 15] }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  if (!projectData?.analysisResults?.length) {
    docDefinition.content.push({ text: 'No analysis results available.', italics: true, color: 'gray' });
  } else {
    projectData.analysisResults.forEach(result => {
      const isOverridden = projectData.studentOverrides?.[result.category]?.isNonIssue;
      const comment = projectData.studentOverrides?.[result.category]?.comment;
      
      docDefinition.content.push({
        columns: [
          { text: result.category, style: 'categoryHeader', width: '*' },
          { 
            text: isOverridden ? 'STUDENT OVERRIDE: False Positive' : `Score: ${result.rating} / 10`, 
            style: isOverridden ? 'overrideText' : 'scoreText',
            width: 'auto',
            alignment: 'right',
            margin: [0, 12, 0, 0]
          }
        ]
      });

      docDefinition.content.push({
        text: result.reasoning,
        style: isOverridden ? 'reasoningOverridden' : 'reasoning'
      });

      if (comment) {
        docDefinition.content.push({ text: 'Student Comment:', style: 'commentHeader' });
        docDefinition.content.push({ text: comment, style: 'commentText' });
      }
      
      // Add a small spacer between items
      docDefinition.content.push({ text: '', margin: [0, 0, 0, 10] });
    });
  }

  pdfMake.createPdf(docDefinition).download(`${groupName}-audit.pdf`);
};

export const generateWorkspacePDF = (items, analysisResults, studentOverrides, projectName) => {
  const completedCount = items.filter(i => i.checked).length;
  
  const docDefinition = {
    content: [
      { text: `Socratic Scorecard: ${projectName || 'Project'}`, style: 'header' },
      { text: 'Review Progress', style: 'sectionHeader', margin: [0, 15, 0, 5] },
      { text: `Items checked off: ${completedCount} / ${items.length}`, margin: [0, 0, 0, 15] },
      
      { text: 'Category Details', style: 'sectionHeader', margin: [0, 15, 0, 5] },
    ],
    styles: {
      header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 12, italics: true, color: 'gray', margin: [0, 0, 0, 20] },
      sectionHeader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
      categoryHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
      scoreText: { fontSize: 10, bold: true, color: '#ef4444' },
      overrideText: { fontSize: 10, bold: true, color: '#3b82f6' },
      reasoning: { fontSize: 11, margin: [0, 0, 0, 10], color: '#333333' },
      reasoningOverridden: { fontSize: 11, margin: [0, 0, 0, 10], color: '#9ca3af', decoration: 'lineThrough' },
      commentHeader: { fontSize: 10, bold: true, color: '#6b7280', margin: [0, 5, 0, 2] },
      commentText: { fontSize: 11, italics: true, margin: [10, 0, 0, 15] }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  items.forEach(item => {
    const result = analysisResults?.find(r => r.category.toLowerCase() === item.category.toLowerCase());
    const isOverridden = studentOverrides?.[item.category]?.isNonIssue;
    const comment = studentOverrides?.[item.category]?.comment;
    
    docDefinition.content.push({
      columns: [
        { text: item.category, style: 'categoryHeader', width: '*' },
        { 
          text: result ? (isOverridden ? 'STUDENT OVERRIDE: False Positive' : `Score: ${result.rating} / 10`) : 'Not analyzed', 
          style: isOverridden ? 'overrideText' : 'scoreText',
          color: result ? undefined : 'gray',
          width: 'auto',
          alignment: 'right',
          margin: [0, 12, 0, 0]
        }
      ]
    });

    if (result) {
      docDefinition.content.push({
        text: result.reasoning,
        style: isOverridden ? 'reasoningOverridden' : 'reasoning'
      });
    }

    if (comment) {
      docDefinition.content.push({ text: 'Student Comment:', style: 'commentHeader' });
      docDefinition.content.push({ text: comment, style: 'commentText' });
    }
    
    docDefinition.content.push({ text: '', margin: [0, 0, 0, 10] });
  });

  pdfMake.createPdf(docDefinition).download(`Scorecard-${projectName || 'Project'}.pdf`);
};
