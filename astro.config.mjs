import { defineConfig, passthroughImageService } from 'astro/config';
import {remarkBookImages, rehypeBookSections} from './scripts/book-markdown.mjs';
export default defineConfig({site:'https://mino.co.kr',output:'static',markdown:{gfm:false,smartypants:false,remarkPlugins:[remarkBookImages],rehypePlugins:[rehypeBookSections]},image:{service:passthroughImageService()}});
