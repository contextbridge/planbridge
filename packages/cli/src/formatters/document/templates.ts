import Handlebars from 'handlebars';
import type { AnnotationTemplates } from '#src/formatters/annotation/templates.ts';
import annotationSectionSource from './templates/annotationSection.hbs' with { type: 'text' };
import approvedSource from './templates/approved.hbs' with { type: 'text' };
import changesRequestedSource from './templates/changesRequested.hbs' with { type: 'text' };
import generalFeedbackSectionSource from './templates/generalFeedbackSection.hbs' with { type: 'text' };

export const DOCUMENT_TEMPLATES: AnnotationTemplates = {
  approved: Handlebars.compile(approvedSource, { noEscape: true }),
  changesRequested: Handlebars.compile(changesRequestedSource, { noEscape: true }),
  annotationSection: Handlebars.compile(annotationSectionSource, { noEscape: true }),
  generalFeedbackSection: Handlebars.compile(generalFeedbackSectionSource, { noEscape: true }),
};
