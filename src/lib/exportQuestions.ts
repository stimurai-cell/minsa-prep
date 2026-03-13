import { supabase } from './supabase';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type ExportFormat = 'pdf' | 'docx';

interface ExportFilters {
    areaId?: string;
    topicId?: string;
}

interface ExportQuestion {
    id: string;
    content: string;
    difficulty: string | null;
    exam_year: number | null;
    topic_id: string | null;
    area_id: string | null;
    alternatives: { id: string; content: string; is_correct: boolean }[];
    question_explanations: { content: string }[];
}

interface ExportDataset {
    areaName: string;
    topicName?: string;
    questions: ExportQuestion[];
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function fetchNames(areaId?: string, topicId?: string) {
    let areaName = 'Todas as Áreas';
    let topicName: string | undefined;

    if (areaId) {
        const { data } = await supabase.from('areas').select('id, name').eq('id', areaId).single();
        areaName = data?.name || areaName;
    }

    if (topicId) {
        const { data } = await supabase.from('topics').select('id, name, area_id').eq('id', topicId).single();
        if (data?.name) topicName = data.name;
        if (!areaId && data?.area_id) {
            const { data: area } = await supabase.from('areas').select('id, name').eq('id', data.area_id).single();
            areaName = area?.name || areaName;
        }
    }

    return { areaName, topicName };
}

export async function fetchQuestionsForExport(filters: ExportFilters): Promise<ExportDataset> {
    const { areaId, topicId } = filters;
    const { areaName, topicName } = await fetchNames(areaId, topicId);

    let query = supabase
        .from('questions')
        .select('id, content, difficulty, exam_year, topic_id, area_id, alternatives(id, content, is_correct), question_explanations(content)')
        .order('topic_id', { ascending: true })
        .order('created_at', { ascending: true });

    if (areaId) query = query.eq('area_id', areaId);
    if (topicId) query = query.eq('topic_id', topicId);

    const { data, error } = await query;
    if (error) throw error;

    return {
        areaName,
        topicName,
        questions: (data || []) as ExportQuestion[],
    };
}

export async function exportQuestionsToDocx(dataset: ExportDataset) {
    const doc = new Document({
        styles: {
            default: {
                document: { run: { size: 24 } },
            },
        },
    });

    const headerText = dataset.topicName
        ? `Banco de Questões — ${dataset.areaName} / ${dataset.topicName}`
        : `Banco de Questões — ${dataset.areaName}`;

    const children: Paragraph[] = [
        new Paragraph({
            text: headerText,
            heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
            children: [
                new TextRun({ text: `Total: ${dataset.questions.length} questões`, bold: true }),
            ],
        }),
    ];

    dataset.questions.forEach((q, idx) => {
        children.push(
            new Paragraph({
                text: `${idx + 1}. ${q.content}`,
                heading: HeadingLevel.HEADING_2,
            })
        );

        q.alternatives.forEach((alt, altIdx) => {
            const label = String.fromCharCode(65 + altIdx);
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${label}) `, bold: true }),
                        new TextRun({
                            text: alt.content + (alt.is_correct ? '   ✔' : ''),
                            bold: alt.is_correct,
                        }),
                    ],
                })
            );
        });

        if (q.question_explanations?.[0]?.content) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Explicação: ', bold: true }),
                        new TextRun({ text: q.question_explanations[0].content, italics: true }),
                    ],
                })
            );
        }

        children.push(new Paragraph({ text: '' }));
    });

    doc.addSection({ children });
    const blob = await Packer.toBlob(doc);
    const filename = `questoes_${dataset.topicName ? dataset.topicName : dataset.areaName}.docx`;
    downloadBlob(blob, filename.replace(/\s+/g, '_'));
}

function wrapLines(text: string, max: number) {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
        if ((current + w).length > max) {
            lines.push(current.trim());
            current = '';
        }
        current += w + ' ';
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
}

export async function exportQuestionsToPdf(dataset: ExportDataset) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const addPageWithContent = (contentLines: string[]) => {
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        let y = height - 50;

        const writeLine = (line: string, opts?: { bold?: boolean }) => {
            if (y < 50) {
                page = pdfDoc.addPage();
                y = page.getSize().height - 50;
            }
            page.drawText(line, {
                x: 40,
                y,
                size: 12,
                font,
                color: opts?.bold ? rgb(0, 0, 0) : rgb(0.1, 0.1, 0.1),
            });
            y -= 16;
        };

        contentLines.forEach((line) => writeLine(line));
    };

    const lines: string[] = [];
    lines.push(dataset.topicName ? `Banco — ${dataset.areaName} / ${dataset.topicName}` : `Banco — ${dataset.areaName}`);
    lines.push(`Total: ${dataset.questions.length} questões`);
    lines.push('');

    dataset.questions.forEach((q, idx) => {
        wrapLines(`${idx + 1}. ${q.content}`, 95).forEach((l) => lines.push(l));
        q.alternatives.forEach((alt, altIdx) => {
            const label = String.fromCharCode(65 + altIdx);
            const prefix = `${label}) ${alt.content}${alt.is_correct ? '  [CORRETA]' : ''}`;
            wrapLines(prefix, 90).forEach((l) => lines.push('   ' + l));
        });
        if (q.question_explanations?.[0]?.content) {
            wrapLines(`Explicação: ${q.question_explanations[0].content}`, 92).forEach((l) => lines.push('   ' + l));
        }
        lines.push('');
    });

    addPageWithContent(lines);
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `questoes_${dataset.topicName ? dataset.topicName : dataset.areaName}.pdf`;
    downloadBlob(blob, filename.replace(/\s+/g, '_'));
}

export async function exportQuestions(filters: ExportFilters, format: ExportFormat) {
    const dataset = await fetchQuestionsForExport(filters);
    if (!dataset.questions.length) {
        throw new Error('Não há questões para exportar com este filtro.');
    }
    if (format === 'docx') return exportQuestionsToDocx(dataset);
    return exportQuestionsToPdf(dataset);
}
