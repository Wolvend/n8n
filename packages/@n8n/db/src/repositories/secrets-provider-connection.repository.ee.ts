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
		// Subquery to find all connection IDs that have any project assignments
		const assignedConnectionsSubquery = this.manager
			.createQueryBuilder(ProjectSecretsProviderAccess, 'assigned')
			.select('assigned.secretsProviderConnectionId')
			.getQuery();

		return await this.createQueryBuilder('connection')
			.leftJoinAndSelect('connection.projectAccess', 'projectAccess')
			.leftJoinAndSelect('projectAccess.project', 'project')
			.where(
				// Connection is assigned to this specific project
				`connection.id IN (
					SELECT access.secretsProviderConnectionId
					FROM project_secrets_provider_access access
					WHERE access.projectId = :projectId
				)`,
				{ projectId },
			)
			.orWhere(
				// OR connection is global (not assigned to any project)
				`connection.id NOT IN (${assignedConnectionsSubquery})`,
			)
			.getMany();
	}
}
