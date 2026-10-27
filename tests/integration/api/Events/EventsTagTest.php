<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Events;

use Flarum\Tags\Tag;
use PHPUnit\Framework\Attributes\Test;

/**
 * Com `canela.events_tag`, os eventos só valem nas discussões daquela tag:
 * fora dela, o `[event]` é só texto.
 */
class EventsTagTest extends AbstractEventsTestCase
{
    protected array $extraExtensions = ['flarum-tags'];

    public function setUp(): void
    {
        parent::setUp();

        $this->setting('canela.events_tag', '1');
        $this->setting('flarum-tags.min_primary_tags', '1');

        $this->prepareDatabase([
            Tag::class => [
                ['id' => 1, 'name' => 'Eventos', 'slug' => 'eventos', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Geral', 'slug' => 'geral', 'position' => 1, 'parent_id' => null],
            ],
        ]);
    }

    private function inTag(int $tagId): array
    {
        return ['tags' => ['data' => [['type' => 'tags', 'id' => (string) $tagId]]]];
    }

    #[Test]
    public function evento_na_tag_dos_eventos_e_gravado(): void
    {
        $json = $this->createDiscussion($this->eventCode(), 1, $this->inTag(1));

        $this->assertNotNull($this->eventId((int) $json['data']['id']));
    }

    #[Test]
    public function evento_fora_da_tag_e_ignorado(): void
    {
        $json = $this->createDiscussion($this->eventCode(), 1, $this->inTag(2));

        $this->assertNull($this->eventId((int) $json['data']['id']));

        [, $agenda] = $this->agenda(1, ['from' => '2030-05-01', 'to' => '2030-05-31']);
        $this->assertSame([], $agenda['events']);
    }
}
