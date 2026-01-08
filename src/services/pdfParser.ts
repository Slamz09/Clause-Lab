import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
  }).promise;

  const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY = -1;
      let pageText = '';
      
      for (const item of textContent.items as any[]) {
        const y = item.transform[5];
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          pageText += '\n';
          // If the gap is large, treat as a potential paragraph break
          if (Math.abs(y - lastY) > 15) {
            pageText += '\n';
          }
        } else if (lastY !== -1) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = y;
      }

      textParts.push(pageText);
    }

  return textParts.join('\n\n');
}
