import { Module, Global } from '@nestjs/common';
import { Mem0Service } from './mem0.service';

@Global()
@Module({
  providers: [Mem0Service],
  exports: [Mem0Service],
})
export class Mem0Module {}
