import type Handlebars from 'handlebars';

type HandlebarsTemplateDelegate<T> = Handlebars.TemplateDelegate<T>;

export interface RevisionInstructions {
  readonly planId: string;
  readonly command?: string;
  readonly directive?: string;
}

export interface AnnotationTemplates {
  approved: HandlebarsTemplateDelegate<{ source?: string }>;
  changesRequested: HandlebarsTemplateDelegate<{ body: string; source?: string; revision?: RevisionInstructions }>;
  annotationSection: HandlebarsTemplateDelegate<{
    range: string;
    sourceSlice: string;
    highlighted: string | undefined;
    comments: string;
  }>;
  generalFeedbackSection: HandlebarsTemplateDelegate<{ comments: string }>;
}
