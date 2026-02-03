import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { ProjectSecretsProviderAccess, SecretsProviderConnection } from '../entities';

@Service()
export class SecretsProviderConnectionRepository extends Repository<SecretsProviderConnection> {
	constructor(dataSource: DataSource) {
		super(SecretsProviderConnection, dataSource.manager);
	}

	async findAll(): Promise<SecretsProviderConnection[]> {
		return await this.find();
	}

	/**
	 * Find all global connections (connections with no project access entries)
	 */
	async findGlobalConnections(): Promise<SecretsProviderConnection[]> {
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.leftJoin('connection.projectAccess', 'access')
			.where('access.secretsProviderConnectionId IS NULL')
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all enabled connections that have access to a specific project
	 */
	async findByProjectId(projectId: string): Promise<SecretsProviderConnection[]> {
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.innerJoin('connection.projectAccess', 'access')
			.where('access.projectId = :projectId', { projectId })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find connections accessible to a project:
	 * - Connections specifically assigned to this project
	 * - Global connections (those with no project assignments)
	 */
	async findByProjectIdWithGlobal(projectId: string): Promise<SecretsProviderConnection[]> {
		return await this.createQueryBuilder('connection')
			.leftJoinAndSelect('connection.projectAccess', 'projectAccess')
			.leftJoinAndSelect('projectAccess.project', 'project')
			.where(
				(qb) => {
					// Connection is assigned to this project
					const subQuery = qb
						.subQuery()
						.select('1')
						.from(ProjectSecretsProviderAccess, 'access')
						.where('access.secretsProviderConnectionId = connection.id')
						.andWhere('access.projectId = :projectId')
						.getQuery();
					return `EXISTS (${subQuery})`;
				},
				{ projectId },
			)
			.orWhere((qb) => {
				// Connection is global (no project assignments)
				const subQuery = qb
					.subQuery()
					.select('1')
					.from(ProjectSecretsProviderAccess, 'access')
					.where('access.secretsProviderConnectionId = connection.id')
					.getQuery();
				return `NOT EXISTS (${subQuery})`;
			})
			.getMany();
	}
}
