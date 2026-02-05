import { BlogEntry, BlogEntryFull } from './blog.types';
import { extractFirstBigParagraph } from './list.utils';

export function makeLightBlogList(fullList: BlogEntryFull[]): BlogEntry[] {
  return fullList
    .filter(entry => !entry.meta.hidden)
    .map(entry => {
      const result: BlogEntry = {
        slug: entry.slug,
        html: extractFirstBigParagraph(entry.html),
        meta: {
          title: entry.meta.title,
          author: entry.meta.author,
          mail: entry.meta.mail,
          published: entry.meta.published,
          language: entry.meta.language,
          header: entry.meta.header,
        },
      };

      if (entry.meta.author2) { result.meta.author2 = entry.meta.author2; }
      if (entry.meta.mail2) { result.meta.mail2 = entry.meta.mail2; }
      if (entry.meta.isUpdatePost) { result.meta.isUpdatePost = entry.meta.isUpdatePost; }

      return result;
    });
}
