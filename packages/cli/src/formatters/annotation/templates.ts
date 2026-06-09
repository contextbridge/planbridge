import type Handlebars from 'handlebars';

type HandlebarsTemplateDelegate<T> = Handlebars.TemplateDelegate<T>;

export interface AnnotationTemplates {
  approved: HandlebarsTemplateDelegate<{ source?: string }>;
  changesRequested: HandlebarsTemplateDelegate<{ body: string; source?: string }>;
  annotationSection: HandlebarsTemplateDelegate<{
    range: string;
    sourceSlice: string;
    focus: string | undefined;
    comments: string;
  }>;
  generalFeedbackSection: HandlebarsTemplateDelegate<{ comments: string }>;
}
