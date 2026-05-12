import type Handlebars from 'handlebars';

type HandlebarsTemplateDelegate<T> = Handlebars.TemplateDelegate<T>;

export interface AnnotationTemplates {
  approved: HandlebarsTemplateDelegate<Record<string, never>>;
  changesRequested: HandlebarsTemplateDelegate<{ body: string }>;
  annotationSection: HandlebarsTemplateDelegate<{
    range: string;
    sourceSlice: string;
    highlighted: string | undefined;
    comments: string;
  }>;
  generalFeedbackSection: HandlebarsTemplateDelegate<{ comments: string }>;
}
