'use client';

import { useEffect, useRef } from 'react';
import type { SaleRecord } from '@/types/sales';

interface Props {
    sale: SaleRecord | null;
    settings?: any;
}

export default function InvoicePrinter({ sale, settings }: Props) {
    const printWindowRef = useRef<Window | null>(null);

    // Using the same format as the old sales page to keep backwards compatibility
    const generateHtml = () => {
        if (!sale) return '';
        
        const shopName = settings?.shop_name || 'iCase Service';
        const address = settings?.address || 'Siem Reap';
        const phone = settings?.phone || '012 345 678';
        const itemsList = (sale.items || []).map(
            (item) => `
            <tr>
                <td style="padding: 4px 0; border-bottom: 1px dashed #ccc;">${item.description || item.name}</td>
                <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: center;">${item.qty}</td>
                <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">$${item.price}</td>
                <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">$${(item.qty * Number(item.price)).toFixed(2)}</td>
            </tr>
        `,
        ).join('');

        const subtotal = (sale.items || []).reduce(
            (sum, item) => sum + (item.qty * Number(item.price)),
            0,
        );
        const discountText = sale.discountValue > 0
            ? `
            <tr>
                <td colspan="3" style="padding: 4px 0; text-align: right;">Discount (${sale.discountType === 'percent' ? sale.discountValue + '%' : '$' + sale.discountValue}):</td>
                <td style="padding: 4px 0; text-align: right;">-$${sale.discountType === 'percent' ? (subtotal * (sale.discountValue / 100)).toFixed(2) : sale.discountValue.toFixed(2)}</td>
            </tr>`
            : '';

        return `
            <html>
                <head>
                    <title>Receipt - ${sale.saleNo}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 20px; font-size: 12px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .header h1 { margin: 0 0 5px; font-size: 18px; }
                        .header p { margin: 0; }
                        .details { margin-bottom: 15px; }
                        .details table { width: 100%; }
                        .items table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                        .items th { border-bottom: 1px solid #000; padding-bottom: 5px; text-align: left; }
                        .items th.right { text-align: right; }
                        .items th.center { text-align: center; }
                        .totals table { width: 100%; }
                        .footer { text-align: center; margin-top: 30px; font-size: 11px; }
                        @media print {
                            body { width: 80mm; padding: 10px; margin: 0 auto; }
                            @page { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${shopName}</h1>
                        <p>${address}</p>
                        <p>Tel: ${phone}</p>
                    </div>
                    
                    <div class="details">
                        <table>
                            <tr>
                                <td>No: <b>${sale.saleNo}</b></td>
                                <td style="text-align: right;">Date: ${sale.date}</td>
                            </tr>
                            <tr>
                                <td>Customer: ${sale.customer}</td>
                                <td style="text-align: right;">Status: ${sale.status}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="items">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th class="center">Qty</th>
                                    <th class="right">Price</th>
                                    <th class="right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsList}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="totals">
                        <table>
                            <tr>
                                <td colspan="3" style="text-align: right;">Subtotal:</td>
                                <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
                            </tr>
                            ${discountText}
                            <tr>
                                <td colspan="3" style="text-align: right; font-weight: bold; font-size: 14px; padding-top: 10px;">Total:</td>
                                <td style="text-align: right; font-weight: bold; font-size: 14px; padding-top: 10px;">$${sale.amount.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for your business!</p>
                        ${sale.warranty > 0 ? `<p>Warranty: ${sale.warranty} months</p>` : ''}
                    </div>
                </body>
            </html>
        `;
    };

    // We don't render anything visible, this component just handles the print action
    // when a print event is triggered. In a real scenario, this might need a trigger
    // or just exposing a print function.
    return null;
}

export function printInvoice(sale: SaleRecord, settings?: any) {
    // Simple pure function to generate and print
    const shopName = settings?.shop_name || 'iCase Service';
    const address = settings?.address || 'Siem Reap';
    const phone = settings?.phone || '012 345 678';
    
    const itemsList = (sale.items || []).map(
        (item) => `
        <tr>
            <td style="padding: 4px 0; border-bottom: 1px dashed #ccc;">${item.description || item.name}</td>
            <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: center;">${item.qty}</td>
            <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">$${item.price}</td>
            <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">$${(item.qty * Number(item.price)).toFixed(2)}</td>
        </tr>
    `,
    ).join('');

    const subtotal = (sale.items || []).reduce(
        (sum, item) => sum + (item.qty * Number(item.price)),
        0,
    );
    
    const discountText = sale.discountValue > 0
        ? `
        <tr>
            <td colspan="3" style="padding: 4px 0; text-align: right;">Discount (${sale.discountType === 'percent' ? sale.discountValue + '%' : '$' + sale.discountValue}):</td>
            <td style="padding: 4px 0; text-align: right;">-$${sale.discountType === 'percent' ? (subtotal * (sale.discountValue / 100)).toFixed(2) : sale.discountValue.toFixed(2)}</td>
        </tr>`
        : '';

    const htmlContent = `
        <html>
            <head>
                <title>Receipt - ${sale.saleNo}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 20px; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .header h1 { margin: 0 0 5px; font-size: 18px; }
                    .header p { margin: 0; }
                    .details { margin-bottom: 15px; }
                    .details table { width: 100%; }
                    .items table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    .items th { border-bottom: 1px solid #000; padding-bottom: 5px; text-align: left; }
                    .items th.right { text-align: right; }
                    .items th.center { text-align: center; }
                    .totals table { width: 100%; }
                    .footer { text-align: center; margin-top: 30px; font-size: 11px; }
                    @media print {
                        body { width: 80mm; padding: 10px; margin: 0 auto; }
                        @page { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${shopName}</h1>
                    <p>${address}</p>
                    <p>Tel: ${phone}</p>
                </div>
                
                <div class="details">
                    <table>
                        <tr>
                            <td>No: <b>${sale.saleNo}</b></td>
                            <td style="text-align: right;">Date: ${sale.date}</td>
                        </tr>
                        <tr>
                            <td>Customer: ${sale.customer}</td>
                            <td style="text-align: right;">Status: ${sale.status}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="items">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th class="center">Qty</th>
                                <th class="right">Price</th>
                                <th class="right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsList}
                        </tbody>
                    </table>
                </div>
                
                <div class="totals">
                    <table>
                        <tr>
                            <td colspan="3" style="text-align: right;">Subtotal:</td>
                            <td style="text-align: right;">$${subtotal.toFixed(2)}</td>
                        </tr>
                        ${discountText}
                        <tr>
                            <td colspan="3" style="text-align: right; font-weight: bold; font-size: 14px; padding-top: 10px;">Total:</td>
                            <td style="text-align: right; font-weight: bold; font-size: 14px; padding-top: 10px;">$${sale.amount.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="footer">
                    <p>Thank you for your business!</p>
                    ${sale.warranty > 0 ? `<p>Warranty: ${sale.warranty} months</p>` : ''}
                </div>
            </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
            printWin.print();
            printWin.close();
        }, 500);
    } else {
        alert('Please allow popups to print receipts.');
    }
}
