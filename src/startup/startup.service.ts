import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateResultPayload } from 'src/shared/models/update-result';
import {
  EntrepreneurRelationship,
  PhaseRelationship,
  Startup,
} from './entities/startup.entity';
import { FormDocumentService } from 'src/forms/factories/form-document-service';
import { EntrepreneurService } from 'src/entrepreneur/entrepreneur.service';
import { LinkStartupToPhaseArgs } from './args/link-phase-startup.args';
import { forwardRef } from '@nestjs/common';
import { LinkWithTargetsByRequestArgs } from 'src/shared/args/link-with-targets-by-request.args';
import { AggregateBuildOptions } from 'src/shared/models/aggregate-build-options';
import { PageRequest } from 'src/shared/models/page-request';
import { PaginatedResult } from 'src/shared/models/paginated-result';
import { requestUtilities } from 'src/shared/utilities/request.utilities';
import { AuthUser } from 'src/auth/types/auth-user';
import { ValidRoles } from 'src/auth/enums/valid-roles.enum';
import { ExpertService } from '../expert/expert.service';
import { Expert } from 'src/expert/entities/expert.entity';
import { Permission, getPermissionList } from 'src/auth/enums/permissions.enum';
import { DownloadRequestArgs } from 'src/shared/models/download-request.args';
import { DownloadResult } from 'src/shared/models/download-result';
import { excelUtilities } from 'src/shared/utilities/excel.utilities';
import { DownloadsService } from 'src/downloads/downloads.service';
import { TableConfigService } from 'src/table/table-config/table-config.service';
import {
  Entrepreneur,
  StartupRelationship,
} from 'src/entrepreneur/entities/entrepreneur.entity';
import { EmailsService } from 'src/emails/emails.service';
import { ContactArgs } from './args/contact-startup.args';
import { EntrepreneurStartupArgs } from 'src/shared/args/entrepreneur-startup-data';

@Injectable()
export class StartupService implements FormDocumentService<Startup> {
  constructor(
    @InjectModel(Startup.name) private readonly startupModel: Model<Startup>,
    @Inject(forwardRef(() => EntrepreneurService))
    private readonly entrepreneurService: EntrepreneurService,
    @Inject(forwardRef(() => ExpertService))
    private readonly expertService: ExpertService,
    private readonly tableConfigService: TableConfigService,
    private readonly downloadService: DownloadsService,
    @Inject(forwardRef(() => EmailsService))
    private readonly emailsService: EmailsService,
  ) {}

  private static readonly virtualFields = {
    // $addFields: { isProspect: { $eq: [{ $size: '$phases' }, 0] } },
    $addFields: {
      isProspect: {
        $cond: {
          if: { $eq: [{ $size: '$phases' }, 0] },
          then: true,
          else: false,
        },
      },
    },
  };

  /**
   * find startup doc, is only intended to be used by websocket.
   */
  async getDocument(id: string) {
    const document = await this.findOne(id);
    return document;
  }

  /**
   * create startup doc, is only intended to be used by websocket.
   */
  async createDocument(submission: any, context?: any) {
    const data = {
      item: submission,
    };
    const createdDocument = await this.create(data);
    if (context && createdDocument && context.entrepreneur) {
      const entrepreneur = context.entrepreneur;
      const linkResult = await this.linkStartupsAndEntrepreneurs(
        [createdDocument._id],
        [entrepreneur],
        'leader',
      );
      if (!linkResult.acknowledged)
        throw new InternalServerErrorException(
          'Failed to link entrepreneur with startup',
        );
    }
    return createdDocument;
  }

  /**
   * find startup docs request table
   */
  async findManyPage(
    request: PageRequest,
    user: AuthUser,
    outputProjection?: any,
  ): Promise<PaginatedResult<Startup>> {
    const options = new AggregateBuildOptions();
    if (outputProjection) {
      options.outputProjection = outputProjection;
    }
    options.virtualFields = StartupService.virtualFields;
    let aggregationPipeline = requestUtilities.buildAggregationFromRequest(
      request,
      options,
    );
    aggregationPipeline = await this.updatePipelineForUser(
      aggregationPipeline,
      user,
    );
    aggregationPipeline[0]['$match']['item.generic'] = null;
    // filtro personas
    aggregationPipeline[1]['$addFields']['members'] = {
      $filter: {
        input: '$entrepreneurs',
        as: 'entrepreneur',
        cond: { $eq: ['$$entrepreneur.state', 'member'] },
      },
    };
    // aggregationPipeline[2]['$match']['members'] = { $size: 1 };
    const documents = await this.startupModel
      .aggregate(aggregationPipeline)
      .collation({ locale: 'en_US', strength: 2 });
    documents[0].documents = documents[0].documents.map((i) => {
      return { ...i, entrepreneurs: i.members };
    });
    return documents[0];
  }

  /**
   * pipelines table for user
   */
  async updatePipelineForUser(aggregationPipeline: any, user: AuthUser) {
    if (
      user.rolDoc.type === ValidRoles.expert &&
      !getPermissionList(user).includes(Permission.load_all_startups)
    ) {
      const docExpert = await this.expertService.findByAccount(user.uid);
      const idStartups = docExpert.phases.flatMap((phaseProfile) =>
        phaseProfile.startUps.map((startup) => new Types.ObjectId(startup._id)),
      );
      aggregationPipeline[0]['$match']['_id'] = { $in: idStartups };
    }
    if (
      user.rolDoc.type === ValidRoles.teamCoach &&
      !getPermissionList(user).includes(Permission.load_all_startups)
    ) {
      let startupsTeamCoach =
        user.relationsAssign?.startups.map((i) => new Types.ObjectId(i._id)) ??
        [];
      aggregationPipeline[0]['$match']['_id'] = { $in: startupsTeamCoach };
    }
    return aggregationPipeline;
  }

  /**
   * request table with filters
   */
  async findManyIdsByRequest(
    request: PageRequest,
    user: AuthUser,
  ): Promise<string[]> {
    const options = new AggregateBuildOptions();
    options.virtualFields = StartupService.virtualFields;
    options.paginated = false;
    options.outputProjection = { $project: { _id: 1 } };
    let aggregationPipeline = requestUtilities.buildAggregationFromRequest(
      request,
      options,
    );
    aggregationPipeline = await this.updatePipelineForUser(
      aggregationPipeline,
      user,
    );
    aggregationPipeline[0]['$match']['item.generic'] = null;
    const documents = await this.startupModel
      .aggregate(aggregationPipeline)
      .collation({ locale: 'en_US', strength: 2 });
    return documents.map((doc) => doc._id);
  }

  /**
   * link two ways between startup and entrepreneur
   */
  async linkStartupsAndEntrepreneurs(
    ids: string[],
    entrepreneurs: string[],
    rol?: string,
  ): Promise<UpdateResultPayload> {
    // Find docs
    const entrepreneurDocuments =
      await this.entrepreneurService.findMany(entrepreneurs);
    const startups = await this.findMany(ids);
    for (const entrepreneurDoc of entrepreneurDocuments) {
      const lastStartup = entrepreneurDoc.startups.find(
        (i) => i.state === 'member',
      );
      if (!lastStartup) continue;
      await this.unlinkEntrepreneur(lastStartup._id, entrepreneurDoc._id);
    }
    // Link entrepreneurs to startups by given relationships
    const startupsToLink = [];
    for (const startupDoc of startups) {
      const entrepreneurLink = {
        _id: startupDoc._id,
        item: startupDoc.item,
        phases: startupDoc.phases,
        state: 'member',
      };
      startupsToLink.push(entrepreneurLink);
    }
    const entrepreneurUpdateResult =
      await this.entrepreneurService.linkWithStartups(
        entrepreneurs,
        startupsToLink,
      );

    if (!entrepreneurUpdateResult.acknowledged)
      throw new InternalServerErrorException(
        'Failed to create link between startups and entrepreneurs',
      );

    const entrepreneurRelationships = entrepreneurDocuments.map((document) => {
      return {
        _id: document._id,
        item: document.item,
        rol: rol ? rol : 'partner',
        description: '',
        state: 'member',
      };
    });
    const startupUpdateResult = await this.linkWithEntrepreneurs(
      ids,
      entrepreneurRelationships,
    );
    return startupUpdateResult;
  }

  /**
   * link only startup with entrepreneurs by property
   */
  async linkWithEntrepreneurs(
    ids: string[],
    entrepreneurRelationships: EntrepreneurRelationship[],
  ): Promise<UpdateResultPayload> {
    return this.startupModel
      .updateMany(
        { _id: { $in: ids } },
        { $addToSet: { entrepreneurs: { $each: entrepreneurRelationships } } },
        { new: true },
      )
      .lean();
  }

  /**
   * update startup doc, is only intended to be used by websocket.
   */
  async updateDocument(id: string, submission: any, context: any) {
    const updatedDocument = await this.update(id, { item: submission });
    return updatedDocument;
  }

  /**
   * find all startup doc
   */
  async findAll(): Promise<Startup[]> {
    const startups = await this.startupModel.find({
      deletedAt: null,
      'item.generic': null,
    });
    return startups;
  }

  /**
   * find startup doc by entrepreneur
   */
  async findByEntrepreneur(idEntrepreneur: string): Promise<Startup[]> {
    const startup = await this.startupModel
      .find({
        deletedAt: null,
        'entrepreneurs._id': new Types.ObjectId(idEntrepreneur),
      })
      .lean();
    return startup;
  }

  /**
   * find startup doc like communities
   */
  async findLikeCommunity(): Promise<Startup[]> {
    const startups = await this.startupModel.aggregate([
      {
        $addFields: {
          leaderEntrepreneurs: {
            $filter: {
              input: '$entrepreneurs',
              as: 'entrepreneur',
              cond: { $eq: ['$$entrepreneur.rol', 'leader'] },
            },
          },
          lastPhase: {
            $arrayElemAt: ['$phases', -1], // Obtiene el último elemento del array 'phases'
          },
          members: {
            $filter: {
              input: '$entrepreneurs',
              as: 'entrepreneur',
              cond: { $eq: ['$$entrepreneur.state', 'member'] },
            },
          },
        },
      },
      {
        $match: {
          leaderEntrepreneurs: { $size: 1 },
          phases: { $size: 1 },
          'item.generic': null,
          deleteAt: null,
          $expr: { $gte: [{ $size: '$members' }, 1] },
        },
      },
    ]);
    return startups.map((i) => {
      return {
        ...i,
        entrepreneurs: i.leaderEntrepreneurs,
      };
    });
  }

  /**
   * find startup doc by batch and user
   */
  async findByPhase(phase: string, user?: AuthUser): Promise<Startup[]> {
    const initMatch = {
      'phases._id': phase,
      deletedAt: null,
    };
    if (user?.rolDoc?.type === ValidRoles.expert) {
      const docExpert = await this.expertService.findByAccount(user.uid);
      const phaseProfileExpert = docExpert.phases.find((i) => i._id === phase);
      let startUpsExpert = phaseProfileExpert.startUps.map(
        (i) => new Types.ObjectId(i._id),
      );
      initMatch['_id'] = { $in: startUpsExpert };
    }
    if (user?.rolDoc?.type === ValidRoles.teamCoach) {
      let startupsTeamCoach =
        user.relationsAssign?.startups.map((i) => new Types.ObjectId(i._id)) ??
        [];
      initMatch['_id'] = { $in: startupsTeamCoach };
    }
    const lookUps = [
      // {
      //   $lookup: {
      //     from: Expert.name,
      //     let: { startupId: '$_id' },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $in: ['$$startupId', '$phases.startUps._id'],
      //           },
      //         },
      //       },
      //       {
      //         $project: {
      //           item: 1,
      //         },
      //       },
      //     ],
      //     as: 'experto',
      //   },
      // },
      // {
      //   $unwind: {
      //     path: '$experto',
      //     preserveNullAndEmptyArrays: true,
      //   },
      // },
    ];
    const project = {
      $project: {
        _id: 1,
        item: 1,
        phases: 1,
        entrepreneurs: 1,
        members: 1,
        // experto: {
        //   $cond: {
        //     if: { $ne: ['$experto', null] },
        //     then: '$experto.item.nombre',
        //     else: null,
        //   },
        // },
      },
    };
    const startups = await this.startupModel.aggregate([
      { $match: initMatch },
      // filtro personas
      {
        $addFields: {
          members: {
            $filter: {
              input: '$entrepreneurs',
              as: 'entrepreneur',
              cond: { $eq: ['$$entrepreneur.state', 'member'] },
            },
          },
        },
      },
      {
        $match: {
          $expr: { $gte: [{ $size: '$members' }, 1] },
        },
      },
      project,
      ...lookUps,
    ]);
    return startups.map((i) => {
      return { ...i, entrepreneurs: i['members'] };
    });
  }

  /**
   * find numb of startups in a batch
   */
  async findNumbParticipants(batch: string) {
    const startups = await this.startupModel.find(
      { 'phases._id': batch, deletedAt: null },
      { _id: 1 },
    );
    return startups.length;
  }

  /**
   * find list of startup doc
   */
  async findMany(ids: string[]): Promise<Startup[]> {
    const startups = await this.startupModel.find({
      _id: { $in: ids },
    });
    return startups;
  }

  /**
   * find startup doc by id
   */
  async findOne(id: string): Promise<Startup> {
    const startup = await this.startupModel.findById(id);
    if (!startup)
      throw new NotFoundException(`Couldn't find startup with id ${id}`);
    return startup;
  }

  /**
   * create startup
   */
  async create(data: Partial<Startup>): Promise<Startup> {
    const createdStartup = await this.startupModel.create(data);
    return createdStartup;
  }

  /**
   * update startup doc
   */
  async update(id: string, data: Partial<Startup>): Promise<Startup> {
    await this.startupModel.updateOne({ _id: id }, data, { new: true }).lean();
    const doc = await this.findOne(id);
    return doc;
  }

  /**
   * soft delete startup doc
   */
  async delete(ids: string[]): Promise<UpdateResultPayload> {
    const updateResult = await this.startupModel.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { deletedAt: Date.now() },
    );
    return {
      ...updateResult,
      upsertedId: updateResult.upsertedId?.toString(),
    };
  }

  /**
   * link startup doc with batch
   */
  async linkWithPhase(
    linkStartUpsToPhaseArgs: LinkStartupToPhaseArgs,
  ): Promise<UpdateResultPayload> {
    const phaseRelationship: PhaseRelationship = {
      _id: linkStartUpsToPhaseArgs.phaseId,
      name: linkStartUpsToPhaseArgs.name,
      state: 'pending',
    };
    const startups = linkStartUpsToPhaseArgs.startups;
    const updateResult = await this.startupModel.updateMany(
      { _id: { $in: startups } },
      { $addToSet: { phases: { $each: [phaseRelationship] } } },
      { new: true },
    );
    if (updateResult.acknowledged) {
      const updatedStartupsRelationships =
        await this.getStartupsRelationships(startups);
      await this.entrepreneurService.updatePhasesForStartupsRelationships(
        updatedStartupsRelationships,
      );
    }
    return UpdateResultPayload.fromPayload(updateResult);
  }

  /**
   * get startup doc reduced relationships
   */
  async getStartupsRelationships(
    ids: string[],
  ): Promise<StartupRelationship[]> {
    return await this.startupModel.find(
      { _id: { $in: ids } },
      { _id: 1, item: 1, phases: 1 },
    );
  }

  /**
   * link entrepreneurs to startups
   */
  async linkWithEntrepreneursByRequest(
    { request, targetIds }: LinkWithTargetsByRequestArgs,
    user: AuthUser,
  ) {
    const startups = await this.findManyIdsByRequest(request, user);
    return await this.linkStartupsAndEntrepreneurs(startups, targetIds);
  }

  /**
   * download table of startups
   */
  async downloadByRequest(
    { request, configId, format }: DownloadRequestArgs,
    user: AuthUser,
  ): Promise<DownloadResult> {
    const config = await this.tableConfigService.findOne(configId);
    const tableColumns = config.columns;
  
    const outputProjection =
      requestUtilities.getProjectionFromConfigTable(tableColumns);
  
    const pageResult = await this.findManyPage(
      { ...request, skip: 0, limit: 10000 },
      user,
      outputProjection,
    );
  
    const rows = excelUtilities.parseDocumentsToRows(
      pageResult.documents,
      tableColumns,
    );
  
    const columns = tableColumns.map((col) => {
      return { header: col.label, width: col.label.length + 3 };
    });
  
    const data = await excelUtilities.buildWorkbookBuffer(
      columns,
      rows,
      format,
    );
  
    const nodeBuffer = Buffer.from(data as Uint8Array);
  
    const fileUrl = await this.downloadService.uploadTempFile(nodeBuffer, format);
  
    return { url: fileUrl };
  }

  /**
   * create a generic startup, only viewed in phase 1, not display in others views
   */
  async genericStartup(entrepreneur?: Entrepreneur) {
    const genericStartupItem: any = {
      nombre: 'Sin startup',
      generic: true,
    };
    const entrepreneurs = [];
    if (entrepreneur) {
      entrepreneurs.push({
        _id: entrepreneur._id,
        item: entrepreneur.item,
        rol: 'leader',
        description: '',
      });
    }
    return await this.create({
      entrepreneurs,
      item: genericStartupItem,
    });
  }

  /**
   * unlink entrepreneurs
   */
  async entrepreneursLeaveStartup(entrepreneurs) {}

  /**
   * email contact startup
   */
  async contactStartup(contactArgs: ContactArgs) {
    try {
      const defaultVerifiedEmail = process.env.SEND_GRID_DEFAULT_VERIFIED_EMAIL;
      await this.emailsService.send({
        from: defaultVerifiedEmail,
        html: `
          <p>
            <span style="font-size:14px">
              <a href="mailto:${contactArgs.from}">${contactArgs.from}</a>&nbsp;<em><strong>te quiere contactar en EcosystemBT</strong></em>
            </span>
          </p>
          <p style="text-align:center">${contactArgs.body}</p>
          <p><span style="font-size:11px"><em>Recuerda que este mensaje es un intermediario, y solo se envió por ecosystem, y no debes responder en este hilo.</em></span></p>
        `,
        subject: contactArgs.subject,
        text: `${contactArgs.from} te quieren contactar en EcosystemBT`,
        to: contactArgs.to,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * unlink entrepreneur and startup
   */
  unlinkEntrepreneur(startupId, entrepreneurId) {
    return this.startupModel.updateOne(
      { _id: startupId, 'entrepreneurs._id': entrepreneurId },
      { $set: { 'entrepreneurs.$.state': 'leaved' } },
    );
  }

  /**
   * update inner data of entrepreneur in startup
   */
  updateDataEntrepreneur(entrepreneurData: EntrepreneurStartupArgs) {
    return this.startupModel.updateOne(
      {
        _id: entrepreneurData.startup,
        'entrepreneurs._id': new Types.ObjectId(entrepreneurData._id),
      },
      {
        $set: {
          'entrepreneurs.$.rol': entrepreneurData.rol,
          'entrepreneurs.$.description': entrepreneurData.description,
        },
      },
    );
  }

  /**
   * get entrepreneurs list
   */
  getEntrepreneurs(ids: string[]) {
    return this.entrepreneurService.findMany(ids);
  }
}
