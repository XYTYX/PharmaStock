interface MedicineData {
  name: string;
  expiryDate: string;
  form: string;
  currentStock: number;
}

export function generateCountingWorksheets(medicines: MedicineData[], t?: (key: string) => string) {
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate worksheets');
    return;
  }

  const html = generateWorksheetHTML(medicines, t);
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

function generateWorksheetHTML(medicines: MedicineData[], t?: (key: string) => string): string {
  const worksheets = medicines.map(medicine => generateSingleWorksheet(medicine, t)).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Medicine Counting Worksheets</title>
      <style>
        ${getWorksheetStyles()}
      </style>
    </head>
    <body>
      ${worksheets}
    </body>
    </html>
  `;
}

function generateSingleWorksheet(medicine: MedicineData, t?: (key: string) => string): string {
  return `
    <div class="worksheet">
      <div class="header">
        <h1 class="medicine-name">${medicine.name}</h1>
        <h2 class="expiry-date">Expiry: ${medicine.expiryDate}</h2>
        <h2 class="form">Form: ${medicine.form}</h2>
      </div>
      
      <div class="content">
        <div class="section-title">${t ? t('counting.individual') : 'Individual'}</div>
        <div class="row">
          <div class="row-content">
            <div class="icon-section">
              <img src="/images/medicine-icons/tablet_and_capsule.png" class="row-img" />
            </div>
            <div class="text-fields">
              <div class="individual-total-section">
                <div class="total-text">${t ? t('counting.total') : 'Total'} (A):</div>
                <div class="individual-subtitle">${t ? t('counting.numberOfIndividual') : 'number of individual'}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="horizontal-divider"></div>
        
        <div class="section-title">${t ? t('counting.package') : 'Package'}</div>
        <div class="row">
          <div class="package-row-container">
            <div class="package-left-half">
              <div class="package-labels">
                <div class="package-label-top">${t ? t('counting.horizontalCount') : 'Horizontal Count'}:</div>
                <div class="package-label-left">${t ? t('counting.verticalCount') : 'Vertical<br/>Count'}:</div>
              </div>
              <div class="package-icon-section">
                <img src="/images/medicine-icons/blister_dims.svg" class="row-img" />
              </div>
            </div>
            <div class="vertical-divider"></div>
            <div class="package-right-half">
              <div class="package-right-top">
                <div class="medicines-per-package-section">
                  <div class="total-text">${t ? t('counting.medicinesPerPackage') : 'Medicines per Package'}</div>
                  <div class="medicines-subtitle">${t ? t('counting.horizontalVerticalCount') : 'Horizontal Count x Vertical Count'}</div>
                </div>
              </div>
              <div class="package-right-middle">
                <div class="text-field">
                  <span class="field-label">${t ? t('counting.numberOfPackages') : 'Number of packages'}:</span>
                </div>
              </div>
              <div class="package-right-bottom">
                <div class="total-text">${t ? t('counting.total') : 'Total'} (B):</div>
                <div class="formula-subtitle">${t ? t('counting.formula') : 'Horizontal count x vertical count x number of packages'}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="horizontal-divider"></div>
        
        <div class="section-title">${t ? t('counting.box') : 'Box'}</div>
        <div class="row">
          <div class="row-content">
            <div class="icon-section">
              <img src="/images/medicine-icons/box.png" class="row-img" />
            </div>
            <div class="box-text-fields">
              <div class="box-text-field">
                <span class="field-label">${t ? t('counting.numberOfBoxes') : 'Number of boxes'}:</span>
              </div>
              <div class="box-text-field">
                <span class="field-label">${t ? t('counting.numberOfPackagesInBox') : 'Number of packages in a box'}:</span>
              </div>
              <div class="box-total-section">
                <div class="total-text">${t ? t('counting.total') : 'Total'} (C):</div>
                <div class="box-formula-subtitle">${t ? t('counting.boxFormula') : 'number of boxes x packages per box x Medicines per package'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <div class="current-stock">Current Stock: ${medicine.currentStock}</div>
        <div class="date">Date: ___________</div>
        <div class="technician">Technician: ___________</div>
      </div>
    </div>
  `;
}

function getWorksheetStyles(): string {
  return `
    @page {
      size: A4;
      margin: 1cm;
    }
    
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: white;
    }
    
    .worksheet {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      border: 2px solid #333;
      padding: 20px;
      box-sizing: border-box;
    }
    
    .header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    
    .medicine-name {
      font-size: 28px;
      font-weight: bold;
      margin: 0 0 10px 0;
      color: #333;
    }
    
    .expiry-date, .form {
      font-size: 20px;
      margin: 5px 0;
      color: #666;
    }
    
    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .row {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 0;
    }
    
    .row-content {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      width: 100%;
      gap: 30px;
    }
    
    .icon-section {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .section-title {
      font-size: 28px;
      font-weight: bold;
      color: #333;
      text-align: center;
    }
    
    .text-fields {
      display: flex;
      flex-direction: column;
      gap: 15px;
      flex: 1;
    }
    
    .text-field {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .field-label {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      white-space: nowrap;
    }
    
    .field-line {
      border-bottom: 2px solid #333;
      min-width: 200px;
      height: 20px;
    }
    
    .field-divider {
      height: 1px;
      background-color: #ccc;
      margin: 5px 0;
    }
    
    .package-row-container {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
    }
    
    .package-left-half {
      display: flex;
      align-items: center;
      justify-content: space-around;
      width: 50%;
      position: relative;
    }
    
    .package-labels {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 1;
    }
    
    .package-label-top {
      font-size: 14px;
      font-weight: bold;
      color: #333;
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
    }
    
    .package-label-left {
      font-size: 14px;
      font-weight: bold;
      color: #333;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }
    
    .package-icon-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      z-index: 0;
    }
    
    .vertical-divider {
      width: 2px;
      background-color: #333;
      margin: 0 20px;
    }
    
    .package-right-half {
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-content: flex-start;
    }
    
    .package-right-top {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .package-right-middle {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .package-right-bottom {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .total-text {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      text-align: center;
      margin-bottom: 8px;
    }
    
    .formula-subtitle {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }
    
    .individual-total-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .individual-subtitle {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      text-align: center;
      line-height: 1.2;
      margin-top: 8px;
    }
    
    .medicines-per-package-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .medicines-subtitle {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }
    
    .box-text-fields {
      display: flex;
      flex-direction: column;
      gap: 15px;
      flex: 1;
    }
    
    .box-text-field {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .box-total-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .box-formula-subtitle {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      text-align: center;
      line-height: 1.2;
      margin-top: 8px;
      white-space: nowrap;
    }
    
    .horizontal-divider {
      height: 2px;
      background-color: #333;
      margin: 10px 0;
    }
    
    .row-img {
      max-width: 200px;
      max-height: 150px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    
    
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 80px;
      padding-top: 60px;
      border-top: 2px solid #333;
      font-size: 14px;
    }
    
    .current-stock {
      font-weight: bold;
    }
    
    .date, .technician {
      border-bottom: 1px solid #333;
      min-width: 100px;
      padding-bottom: 2px;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

